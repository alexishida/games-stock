<!-- Dependências vendorizadas de portabilidade; manter versões/hashes ao atualizar. -->
# Dependências vendorizadas

Os fontes abaixo entram no build nativo apenas para leitura/escrita ZIP/ZIP64. Não são
distribuídos como executáveis separados; o binário final é linkado estaticamente.

| Dependência | Versão | Origem fixada | SHA-256 | Licença |
|---|---|---|---|---|
| libarchive | 3.8.11 | `https://github.com/libarchive/libarchive/releases/download/v3.8.11/libarchive-3.8.11.tar.xz` | `a3dc0872b1b39da34dc18ef1b944f0f11ffd37425d70ae04be679279f1cf43d2` | BSD-2-Clause (`libarchive-3.8.11/COPYING`) |
| zlib | 1.3.1 | `https://github.com/madler/zlib/releases/download/v1.3.1/zlib-1.3.1.tar.gz` | `9a93b2b7dfdac77ceba5a558a580e74667dd6fede4585b91eefb60f03b72df23` | zlib (`zlib-1.3.1/LICENSE`) |

Os arquivos foram extraídos sem modificação. O build usa:

- `BUILD_SHARED_LIBS=OFF` e o alvo `archive_static`;
- `ENABLE_ZLIB=ON` apontando para o zlib vendorizado;
- compressão/formatos opcionais desabilitados (OpenSSL, LZMA, Zstd, bzip2, XML, iconv, ACL, xattr);
- ferramentas `tar`/`cpio`/`cat`/`unzip` desabilitadas; apenas a biblioteca é compilada.

`native/src/portability/ZipArchive.*` isola a API C e mantém o restante do código sem dependência
direta de `archive.h`. O leitor exige um arquivo com seek para consultar o diretório central; caminhos
de entrada são validados antes de extrair para impedir `../` e unidades absolutas.

## Atualizar

1. Baixar a nova versão e conferir o SHA-256 acima.
2. Substituir a pasta correspondente e atualizar esta tabela.
3. Rodar `ctest -R portable-archive` e o teste opt-in `GAMESTOCK_ZIP64_LARGE_TEST=1`.
