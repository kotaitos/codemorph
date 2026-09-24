import subprocess
from pathlib import Path

from codemorph_cli.main import main


def test_init_writes_config_and_excludes_cache(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    assert main(["init", str(tmp_path)]) == 0
    assert (tmp_path / "codemorph.yml").is_file()
    assert ".codemorph/" in (tmp_path / ".git/info/exclude").read_text(encoding="utf-8")
    assert main(["init", str(tmp_path)]) == 1
