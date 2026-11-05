<!-- Extração nativa sem npm; manter origem, versão, checksum e licenças ao atualizar. -->
# 7-Zip para Windows

Binário `win/x64/7za.exe`, 7-Zip 21.07 x64, sem modificações, anteriormente fornecido por
7zip-bin 5.2.0. SHA-256: `b0cfdeaf429f5cc53f85123dd8f5a5feb92c19d31aa34df257edf9a26be05f95`.

É uma ferramenta externa para ROMs ZIP/7z e cache de metadados. O aplicativo C++ a executa
com argumentos separados, sem Node. O deploy copia o binário e os avisos para `tools/`.
`LICENSE-wrapper.txt` preserva o aviso do pacote de origem; não substitui a licença do binário.
Os textos de 21.07 estão em `LICENSE-7zip.txt` e `COPYING-LGPL.txt`, obtidos do repositório oficial:
https://github.com/ip7z/7zip/tree/21.07/DOC
Fontes da mesma versão: https://github.com/ip7z/7zip/tree/21.07

Linux permanece adiado. Quando retomado, requer 7za/7z/7zz instalado e detectado pelo CMake;
não há validação nem distribuição de binário Linux nesta entrega.
