const CONVITES_ENDPOINT = 'https://hjccxfznojjosvanwztv.supabase.co/functions/v1/access-mail-worker';
const CONVITES_CONTA = 'eduardo.falcao@raizeducacao.com.br';

function verificarConfiguracao() {
  const token = ScriptApp.getIdentityToken();
  if (!token) throw new Error('Autorize a identidade Google deste projeto.');
  const claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());
  if (claims.email !== CONVITES_CONTA) throw new Error('Use apenas a conta ' + CONVITES_CONTA);
  console.log(JSON.stringify({email: claims.email, audience: claims.aud, script: ScriptApp.getScriptId(), quota: MailApp.getRemainingDailyQuota()}));
}

function ativarEnvioDeConvites() {
  verificarConfiguracao();
  chamarPlataforma_({action: 'status'});
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'processarConvites')) {
    ScriptApp.newTrigger('processarConvites').timeBased().everyMinutes(1).create();
  }
  console.log('Envio ativado. Apenas convites solicitados na plataforma serao processados.');
}

function pausarEnvioDeConvites() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'processarConvites').forEach(t => ScriptApp.deleteTrigger(t));
  console.log('Automacao de convites pausada.');
}

function processarConvites() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const pending = props.getProperty('CONVITE_CONFIRMAR');
    if (pending) {
      chamarPlataforma_(JSON.parse(pending));
      props.deleteProperty('CONVITE_CONFIRMAR');
    }
    chamarPlataforma_({action: 'status'});
    for (let n = 0; n < 5 && MailApp.getRemainingDailyQuota() > 0; n++) {
      const result = chamarPlataforma_({action: 'claim'});
      const job = result.job;
      if (!job) return;
      if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(job.to) || job.to.length > 254) throw new Error('Destinatario invalido.');
      const receipt = {action: 'ack', id: job.id, lease: job.lease, success: false};
      // Persist before sending: an interrupted execution must never resend blindly.
      props.setProperty('CONVITE_CONFIRMAR', JSON.stringify(receipt));
      try {
        MailApp.sendEmail({to: job.to, subject: job.subject, body: job.text, htmlBody: job.html, name: 'Obras e Real Estate - Raiz Educacao', replyTo: CONVITES_CONTA});
        receipt.success = true;
        props.setProperty('CONVITE_CONFIRMAR', JSON.stringify(receipt));
      } catch (_) {
        chamarPlataforma_(receipt);
        props.deleteProperty('CONVITE_CONFIRMAR');
        throw new Error('Envio nao confirmado. Confira o status na plataforma antes de tentar novamente.');
      }
      chamarPlataforma_(receipt);
      props.deleteProperty('CONVITE_CONFIRMAR');
    }
  } finally {
    lock.releaseLock();
  }
}

function chamarPlataforma_(body) {
  body.quota = MailApp.getRemainingDailyQuota();
  const response = UrlFetchApp.fetch(CONVITES_ENDPOINT, {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getIdentityToken()},
    payload: JSON.stringify(body), muteHttpExceptions: true, followRedirects: false
  });
  const code = response.getResponseCode();
  if (code !== 200) throw new Error('Integracao indisponivel (HTTP ' + code + '). Nenhum reenvio automatico.');
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error('Operacao nao confirmada pela plataforma.');
  return result;
}
