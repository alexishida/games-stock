/** Emulador falso de teste: grava cada argumento em UTF-8 no arquivo recebido. */
#include <cstdio>
#include <cstdlib>
#include <cstring>

#ifdef _WIN32
#include <windows.h>
#include <shellapi.h>
#include <string>
#include <vector>
#endif

int main(int argc, char** argv) {
#ifdef _WIN32
    int count = 0;
    LPWSTR* wideArgs = CommandLineToArgvW(GetCommandLineW(), &count);
    if (!wideArgs) return 2;
    const wchar_t* environmentOutput = _wgetenv(L"FAKE_EMULATOR_OUTPUT");
    const bool useEnvironment = environmentOutput && environmentOutput[0] != L'\0';
    const std::wstring outputPath = useEnvironment ? environmentOutput : (count >= 2 ? wideArgs[1] : L"");
    const int firstArgument = useEnvironment ? 1 : 2;
    if (outputPath.empty() || count < firstArgument) {
        LocalFree(wideArgs);
        return 2;
    }
    FILE* file = _wfopen(outputPath.c_str(), L"wb");
    if (!file) {
        LocalFree(wideArgs);
        return 3;
    }
    for (int index = firstArgument; index < count; ++index) {
        const int size = WideCharToMultiByte(CP_UTF8, 0, wideArgs[index], -1, nullptr, 0, nullptr, nullptr);
        if (size > 1) {
            std::string text(static_cast<size_t>(size), '\0');
            WideCharToMultiByte(CP_UTF8, 0, wideArgs[index], -1, &text[0], size, nullptr, nullptr);
            text.resize(static_cast<size_t>(size - 1));
            std::fwrite(text.data(), 1, text.size(), file);
        }
        std::fputc('\n', file);
    }
    std::fclose(file);
    LocalFree(wideArgs);
#else
    const char* environmentOutput = std::getenv("FAKE_EMULATOR_OUTPUT");
    const bool useEnvironment = environmentOutput && environmentOutput[0] != '\0';
    const char* outputPath = useEnvironment ? environmentOutput : (argc >= 2 ? argv[1] : nullptr);
    const int firstArgument = useEnvironment ? 1 : 2;
    if (!outputPath || argc < firstArgument) return 2;
    FILE* file = std::fopen(outputPath, "wb");
    if (!file) return 3;
    for (int index = firstArgument; index < argc; ++index) {
        std::fwrite(argv[index], 1, std::strlen(argv[index]), file);
        std::fputc('\n', file);
    }
    std::fclose(file);
#endif
    return 0;
}
