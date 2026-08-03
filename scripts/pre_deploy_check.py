"""
Compatibilidade para automacoes antigas.

O verificador real vive na raiz do projeto. Manter duas copias divergentes ja
quebrou a esteira ao apontar para um HTML antigo; este wrapper garante que
qualquer chamada legado execute sempre a validacao canonica atual.
"""
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT / "pre_deploy_check.py"), run_name="__main__")
