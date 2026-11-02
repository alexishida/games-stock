<!-- Evidências de download de mídia e previews de capa (tarefa 7.4). -->
# Mídia e previews de capa

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `native/src/launchbox/LaunchBoxMedia.*` | Download de imagens indexadas, nomes estáveis, `cover.jpg` e `metadata.json`. |

## Regras preservadas

- Cada imagem recebe nome `slug(tipo)-slug(região)-NN.ext`, derivado do tipo, região e ordem no
  índice. Sem região, o nome usa `no_region` como o renderer.
- O diretório do jogo é `images/<plataforma>/<título>-<id>`, sanitizado para Windows/Linux; o ID
  evita que títulos iguais de regiões diferentes compartilhem pasta.
- Arquivos existentes com tamanho maior que zero são reutilizados; `force` baixa de novo.
- Cada transferência usa URL `IMAGES_BASE + filename`, timeout de 30 s, limite de 20 MiB, arquivo
  temporário e publicação com `QSaveFile`; falha preserva a imagem anterior.
- `metadata.json` grava o registro completo do jogo no diretório de mídia.
- O `cover.jpg` usa o box-front de maior prioridade regional:
  `brazil` → `north-america` → `europe` → `world` → `united-states` → `no_region` → primeiro
  disponível.
- Orientação é lida antes do redimensionamento: portrait usa 195×280 e landscape 280×195, ambos com
  `KeepAspectRatio`, `SmoothTransformation` e sem ampliação. A saída é JPEG qualidade 85.
- Imagens pequenas mantêm as dimensões originais; a geração do cover é repetida a partir do arquivo
  local já baixado.

## Evidências

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release -R launchbox-media --output-on-failure
```

`launchbox-media` cobre:

- quatro imagens baixadas com servidor HTTP local, `metadata.json` e `cover.jpg`;
- prioridade Brasil sobre Europa/América do Norte;
- portrait 400×600 resultando em altura 280 e largura ≤195;
- landscape 600×300 resultando em 280×140;
- imagem 50×70 sem ampliação;
- segunda execução sem novo download (`skipped=4` e contagem HTTP estável);
- filtro por tipo impedindo screenshot e falha de uma imagem sem apagar arquivo anterior;
- `preferredBoxArt` retornando o arquivo brasileiro na ordem esperada.

## Pendências relacionadas

- 7.6: importador e sincronização de mídia usando este componente.
- 7.7: lote grande sem escrita SQLite por tick e sem bloquear a UI.
- 9.x: mídia dentro dos pacotes de backup.
