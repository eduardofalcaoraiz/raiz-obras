const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/payment-bundle.js','utf8'),ctx);
const text=`Documento Auxiliar da NFS-e
Numero da NFS-e Competencia da NFS-e Data e Hora da emissao da NFS-e
123 01/01/2026 01/01/2026 12:00:00
Numero da DPS Serie da DPS
456 1
EMITENTE DA NFS-e CNPJ / CPF / NIF
00.000.000/0000-00
Nome / Nome empresarial E-mail
Fornecedor Ficticio
TOMADOR DO SERVICO
11.111.111/1111-11
Descricao do Servico
SERVICO DE TESTE
TRIBUTACAO MUNICIPAL
VALOR TOTAL DA NFS-E
Valor do Servico Desconto Condicionado
R$100,00 R$0,00
Total do IBS/CBS Valor Liquido NFS-e + IBS/CBS
R$1,00 R$101,00`;
const n=ctx.PaymentBundle.nationalServiceInvoice(text);
assert.equal(n.doc,'123');assert.equal(n.tipo,'NFS-e');assert.equal(n.cnpj,'00.000.000/0000-00');
assert.equal(n.val,100);assert.equal(n.date,'2026-01-01');assert.equal(n.itens.length,1);
assert.equal(ctx.PaymentBundle.nationalServiceInvoice('Orcamento 123 R$100,00'),null);
assert.equal(ctx.PaymentBundle.nationalServiceInvoice(text.replace('R$100,00','sem valor')),null);
const docs=[{invoiceIdentity:{invoiceNumber:'123',issuerCnpj:n.cnpj,type:n.tipo,total:n.val}},{invoiceIdentity:{invoiceNumber:'123',issuerCnpj:n.cnpj,type:n.tipo,total:n.val}},{invoiceIdentity:{invoiceNumber:'124',issuerCnpj:n.cnpj,type:n.tipo,total:100}}];
assert.equal(ctx.PaymentBundle.invoices({docs}).length,2);
assert.equal(ctx.PaymentBundle.invoices({docs}).reduce((s,n)=>s+n.total,0),200);
console.log('PASS: NFS-e versus DPS, issuer versus payer, service value, partial documents and invoice deduplication.');

