/** Catálogo de plataformas gerado de src/main/db/platformCatalog.ts; não editar à mão. */
// Gerado por scripts/native-platform-catalog.cjs. A ordem preserva os IDs do Electron.
#include "PlatformCatalogData.h"

namespace gamestock::catalog {

const QList<PlatformEntry>& platforms() {
    static const QList<PlatformEntry> entries = {
        PlatformEntry{
            QStringLiteral("Arcade"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Arcade"), QStringLiteral("MAME")},
            {
                RomExtension{QStringLiteral(".chd"), QStringLiteral("Imagem de disco arcade"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Capcom CPS-1"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Arcade - Capcom CPS-1"), QStringLiteral("Capcom CPS-1")},
            {
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Capcom CPS-2"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Arcade - Capcom CPS-2"), QStringLiteral("Capcom CPS-2")},
            {
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Capcom CPS-3"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Arcade - Capcom CPS-3"), QStringLiteral("Capcom CPS-3")},
            {
                RomExtension{QStringLiteral(".chd"), QStringLiteral("Imagem de disco CPS-3"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Atari 2600"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Atari 2600")},
            {
                RomExtension{QStringLiteral(".a26"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Binario generico"), false},
                RomExtension{QStringLiteral(".rom"), QStringLiteral("ROM generica"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Atari 7800"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Atari 7800")},
            {
                RomExtension{QStringLiteral(".a78"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Binario generico"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Commodore 64"),
            QStringLiteral("PC"),
            {QStringLiteral("Commodore 64"), QStringLiteral("Commodore C64"), QStringLiteral("C64")},
            {
                RomExtension{QStringLiteral(".d64"), QStringLiteral("Imagem de disquete 1541"), true},
                RomExtension{QStringLiteral(".t64"), QStringLiteral("Tape archive"), true},
                RomExtension{QStringLiteral(".prg"), QStringLiteral("Programa executavel"), true},
                RomExtension{QStringLiteral(".crt"), QStringLiteral("Imagem de cartucho"), true},
                RomExtension{QStringLiteral(".tap"), QStringLiteral("Imagem de fita"), true},
                RomExtension{QStringLiteral(".g64"), QStringLiteral("Imagem de disquete"), true},
                RomExtension{QStringLiteral(".nib"), QStringLiteral("Imagem de disquete"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Commodore Amiga"),
            QStringLiteral("PC"),
            {QStringLiteral("Commodore Amiga"), QStringLiteral("Amiga")},
            {
                RomExtension{QStringLiteral(".adf"), QStringLiteral("Amiga Disk File"), true},
                RomExtension{QStringLiteral(".dms"), QStringLiteral("Disk Masher System"), true},
                RomExtension{QStringLiteral(".lha"), QStringLiteral("Arquivo LHA"), true},
                RomExtension{QStringLiteral(".ipf"), QStringLiteral("Preservation format"), true},
                RomExtension{QStringLiteral(".hdf"), QStringLiteral("Hard Disk File"), true},
                RomExtension{QStringLiteral(".adz"), QStringLiteral("ADF comprimido"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Game Boy"),
            QStringLiteral("Portateis"),
            {QStringLiteral("Nintendo Game Boy"), QStringLiteral("Game Boy")},
            {
                RomExtension{QStringLiteral(".gb"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".sgb"), QStringLiteral("Super Game Boy ROM"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Game Boy Advance"),
            QStringLiteral("Portateis"),
            {QStringLiteral("Nintendo Game Boy Advance"), QStringLiteral("Game Boy Advance"), QStringLiteral("GBA")},
            {
                RomExtension{QStringLiteral(".gba"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".agb"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Game Boy Color"),
            QStringLiteral("Portateis"),
            {QStringLiteral("Nintendo Game Boy Color"), QStringLiteral("Game Boy Color"), QStringLiteral("GBC")},
            {
                RomExtension{QStringLiteral(".gbc"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".cgb"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Nintendo 64"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Nintendo 64"), QStringLiteral("N64")},
            {
                RomExtension{QStringLiteral(".n64"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".z64"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".v64"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Nintendo DS"),
            QStringLiteral("Portateis"),
            {QStringLiteral("Nintendo DS"), QStringLiteral("NDS")},
            {
                RomExtension{QStringLiteral(".nds"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".dsi"), QStringLiteral("Cartucho DSi Enhanced"), true},
                RomExtension{QStringLiteral(".ids"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Nintendo NES"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Nintendo Entertainment System"), QStringLiteral("Nintendo NES / Famicom"), QStringLiteral("NES"), QStringLiteral("Famicom")},
            {
                RomExtension{QStringLiteral(".nes"), QStringLiteral("iNES format"), true},
                RomExtension{QStringLiteral(".unf"), QStringLiteral("UNIF format"), true},
                RomExtension{QStringLiteral(".unif"), QStringLiteral("UNIF format"), true},
                RomExtension{QStringLiteral(".fds"), QStringLiteral("Famicom Disk System"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Nintendo GameCube"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Nintendo GameCube"), QStringLiteral("GameCube")},
            {
                RomExtension{QStringLiteral(".iso"), QStringLiteral("Imagem de disco"), true},
                RomExtension{QStringLiteral(".gcm"), QStringLiteral("GameCube Master Disc Image"), true},
                RomExtension{QStringLiteral(".rvz"), QStringLiteral("RVZ compressed image"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Nintendo Wii"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Nintendo Wii"), QStringLiteral("Wii")},
            {
                RomExtension{QStringLiteral(".iso"), QStringLiteral("Imagem de disco"), true},
                RomExtension{QStringLiteral(".wbfs"), QStringLiteral("Wii Backup File System"), true},
                RomExtension{QStringLiteral(".rvz"), QStringLiteral("RVZ compressed image"), true},
                RomExtension{QStringLiteral(".wad"), QStringLiteral("Wii Channel package"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sony PlayStation"),
            QStringLiteral("Consoles"),
            {QStringLiteral("PlayStation"), QStringLiteral("Sony PlayStation"), QStringLiteral("Sony Playstation"), QStringLiteral("PS1")},
            {
                RomExtension{QStringLiteral(".cue"), QStringLiteral("Imagem de CD"), true},
                RomExtension{QStringLiteral(".img"), QStringLiteral("Imagem de CD"), true},
                RomExtension{QStringLiteral(".iso"), QStringLiteral("Imagem ISO"), true},
                RomExtension{QStringLiteral(".pbp"), QStringLiteral("Eboot comprimido"), true},
                RomExtension{QStringLiteral(".chd"), QStringLiteral("Compressed Hunks of Data"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("BIN de faixa"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sony PlayStation 2"),
            QStringLiteral("Consoles"),
            {QStringLiteral("PlayStation 2"), QStringLiteral("Sony PlayStation 2"), QStringLiteral("Sony Playstation 2"), QStringLiteral("PS2")},
            {
                RomExtension{QStringLiteral(".iso"), QStringLiteral("Imagem ISO"), true},
                RomExtension{QStringLiteral(".cue"), QStringLiteral("Imagem de CD/DVD"), true},
                RomExtension{QStringLiteral(".chd"), QStringLiteral("Compressed Hunks of Data"), true},
                RomExtension{QStringLiteral(".cso"), QStringLiteral("Compressed ISO"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("BIN de faixa"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega CD"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Sega CD"), QStringLiteral("Mega-CD"), QStringLiteral("Mega CD")},
            {
                RomExtension{QStringLiteral(".cue"), QStringLiteral("Imagem de CD"), true},
                RomExtension{QStringLiteral(".iso"), QStringLiteral("Imagem ISO"), true},
                RomExtension{QStringLiteral(".chd"), QStringLiteral("Compressed Hunks of Data"), true},
                RomExtension{QStringLiteral(".img"), QStringLiteral("Imagem de CD"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("BIN de faixa"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Dreamcast"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Sega Dreamcast"), QStringLiteral("Dreamcast")},
            {
                RomExtension{QStringLiteral(".gdi"), QStringLiteral("GD-ROM dump"), true},
                RomExtension{QStringLiteral(".cdi"), QStringLiteral("DiscJuggler image"), true},
                RomExtension{QStringLiteral(".chd"), QStringLiteral("Compressed Hunks of Data"), true},
                RomExtension{QStringLiteral(".iso"), QStringLiteral("Imagem ISO"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Game Gear"),
            QStringLiteral("Portateis"),
            {QStringLiteral("Sega Game Gear"), QStringLiteral("Game Gear")},
            {
                RomExtension{QStringLiteral(".gg"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Binario generico"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Master System"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Sega Master System"), QStringLiteral("Master System")},
            {
                RomExtension{QStringLiteral(".sms"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Binario generico"), false},
                RomExtension{QStringLiteral(".sg"), QStringLiteral("SG format"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Mega Drive"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Sega Mega Drive"), QStringLiteral("Sega Genesis"), QStringLiteral("Mega Drive"), QStringLiteral("Sega Mega Drive / Genesis")},
            {
                RomExtension{QStringLiteral(".md"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".gen"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".smd"), QStringLiteral("Super Magic Drive format"), true},
                RomExtension{QStringLiteral(".68k"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Binario generico"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Saturn"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Sega Saturn"), QStringLiteral("Saturn")},
            {
                RomExtension{QStringLiteral(".cue"), QStringLiteral("Imagem de CD"), true},
                RomExtension{QStringLiteral(".iso"), QStringLiteral("Imagem ISO"), true},
                RomExtension{QStringLiteral(".chd"), QStringLiteral("Compressed Hunks of Data"), true},
                RomExtension{QStringLiteral(".mds"), QStringLiteral("Alcohol 120% image"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("BIN de faixa"), false},
                RomExtension{QStringLiteral(".mdf"), QStringLiteral("Arquivo de dados MDS"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Super Nintendo"),
            QStringLiteral("Consoles"),
            {QStringLiteral("Super Nintendo"), QStringLiteral("Super Nintendo Entertainment System"), QStringLiteral("SNES"), QStringLiteral("Super Famicom"), QStringLiteral("Nintendo Super Famicom"), QStringLiteral("Super Famicom")},
            {
                RomExtension{QStringLiteral(".sfc"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".smc"), QStringLiteral("Super Magic Card format"), true},
                RomExtension{QStringLiteral(".fig"), QStringLiteral("Cartucho ROM"), true},
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Binario generico"), false},
                RomExtension{QStringLiteral(".swc"), QStringLiteral("Super Wild Card format"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Game Engine"),
            QStringLiteral("PC"),
            {QStringLiteral("Game Engine (SCUMM/etc.)"), QStringLiteral("ScummVM")},
            {
                RomExtension{QStringLiteral(".dat"), QStringLiteral("Arquivo de dados"), true},
                RomExtension{QStringLiteral(".pak"), QStringLiteral("Pacote de assets"), true},
                RomExtension{QStringLiteral(".wad"), QStringLiteral("WAD"), true},
                RomExtension{QStringLiteral(".grp"), QStringLiteral("Build Engine Group File"), true},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sammy Atomiswave"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Sammy Atomiswave"), QStringLiteral("Atomiswave")},
            {
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Imagem de cartucho arcade"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Model 2"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Sega Model 2"), QStringLiteral("Arcade - Sega Model 2")},
            {
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Model 3"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Sega Model 3"), QStringLiteral("Arcade - Sega Model 3")},
            {
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Conjunto de ROM Model 3"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Naomi"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Sega Naomi"), QStringLiteral("Naomi")},
            {
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Imagem de cartucho arcade"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Sega Naomi 2"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Sega Naomi 2"), QStringLiteral("Naomi 2")},
            {
                RomExtension{QStringLiteral(".bin"), QStringLiteral("Imagem de cartucho arcade"), false},
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("SNK Neo Geo MVS"),
            QStringLiteral("Arcade"),
            {QStringLiteral("SNK Neo Geo MVS"), QStringLiteral("Neo Geo MVS")},
            {
                RomExtension{QStringLiteral(".7z"), QStringLiteral("Arquivo compactado"), true},
                RomExtension{QStringLiteral(".zip"), QStringLiteral("Arquivo compactado"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("Taito Type X"),
            QStringLiteral("Arcade"),
            {QStringLiteral("Taito Type X"), QStringLiteral("Taito Type X2"), QStringLiteral("Taito Type X3")},
            {
                RomExtension{QStringLiteral(".exe"), QStringLiteral("Executavel do jogo arcade"), true},
                RomExtension{QStringLiteral(".bat"), QStringLiteral("Script de inicializacao arcade"), true},
            },
        },
        PlatformEntry{
            QStringLiteral("TeknoParrot"),
            QStringLiteral("Arcade"),
            {QStringLiteral("TeknoParrot")},
            {
                RomExtension{QStringLiteral(".xml"), QStringLiteral("Perfil de jogo TeknoParrot"), true},
            },
        },
    };
    return entries;
}

const QList<QPair<QString, QString>>& legacyAliases() {
    static const QList<QPair<QString, QString>> aliases = {
        {QStringLiteral("Sega Genesis"), QStringLiteral("Sega Mega Drive")},
        {QStringLiteral("NES"), QStringLiteral("Nintendo NES")},
        {QStringLiteral("Nintendo Entertainment System"), QStringLiteral("Nintendo NES")},
        {QStringLiteral("PlayStation"), QStringLiteral("Sony PlayStation")},
        {QStringLiteral("Sony Playstation"), QStringLiteral("Sony PlayStation")},
        {QStringLiteral("PlayStation 2"), QStringLiteral("Sony PlayStation 2")},
        {QStringLiteral("Sony Playstation 2"), QStringLiteral("Sony PlayStation 2")},
        {QStringLiteral("Super Nintendo Entertainment System"), QStringLiteral("Super Nintendo")},
    };
    return aliases;
}

} // namespace gamestock::catalog
