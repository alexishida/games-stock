# Projeto oficial C++20/Qt Quick; dependências de extração são locais, sem npm.
cmake_minimum_required(VERSION 3.25)
project(GameStockNative VERSION 1.1.5 LANGUAGES CXX)

find_package(Qt6 6.8.3 EXACT REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2 Sql Network Svg Test QuickDialogs2)
qt_standard_project_setup(REQUIRES 6.8)
include(CTest)
# Linux usa ferramenta do sistema quando retomado; o pacote Windows é vendorizado.
if(NOT WIN32)
    find_program(GAMESTOCK_7Z_EXECUTABLE NAMES 7za 7z 7zz)
endif()

# ── Dependências fixas de portabilidade ─────────────────────────────────────
# zlib e libarchive ficam vendorizados em native/third_party com versões e hashes
# registrados em native/third_party/README.md. Apenas ZIP/ZIP64 é habilitado.
set(ZLIB_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(ZLIB_BUILD_SHARED OFF CACHE BOOL "" FORCE)
add_subdirectory(third_party/zlib-1.3.1 zlib_build EXCLUDE_FROM_ALL)
set(ZLIB_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/zlib-1.3.1" CACHE PATH "" FORCE)
set(ZLIB_LIBRARY zlibstatic CACHE STRING "" FORCE)
set(ZLIB_LIBRARIES zlibstatic CACHE STRING "" FORCE)
set(ZLIB_FOUND TRUE CACHE BOOL "" FORCE)

set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(ENABLE_OPENSSL OFF CACHE BOOL "" FORCE)
set(ENABLE_MBEDTLS OFF CACHE BOOL "" FORCE)
set(ENABLE_NETTLE OFF CACHE BOOL "" FORCE)
set(ENABLE_MD OFF CACHE BOOL "" FORCE)
set(ENABLE_LIBB2 OFF CACHE BOOL "" FORCE)
set(ENABLE_LZ4 OFF CACHE BOOL "" FORCE)
set(ENABLE_LZO OFF CACHE BOOL "" FORCE)
set(ENABLE_LZMA OFF CACHE BOOL "" FORCE)
set(ENABLE_ZSTD OFF CACHE BOOL "" FORCE)
set(ENABLE_BZip2 OFF CACHE BOOL "" FORCE)
set(ENABLE_LIBXML2 OFF CACHE BOOL "" FORCE)
set(ENABLE_BSDXML OFF CACHE BOOL "" FORCE)
set(ENABLE_EXPAT OFF CACHE BOOL "" FORCE)
set(ENABLE_WIN32_XMLLITE OFF CACHE BOOL "" FORCE)
set(ENABLE_PCREPOSIX OFF CACHE BOOL "" FORCE)
set(ENABLE_PCRE2POSIX OFF CACHE BOOL "" FORCE)
set(POSIX_REGEX_LIB "NONE" CACHE STRING "" FORCE)
set(ENABLE_LIBGCC OFF CACHE BOOL "" FORCE)
set(ENABLE_CNG OFF CACHE BOOL "" FORCE)
set(ENABLE_TAR OFF CACHE BOOL "" FORCE)
set(ENABLE_CPIO OFF CACHE BOOL "" FORCE)
set(ENABLE_CAT OFF CACHE BOOL "" FORCE)
set(ENABLE_UNZIP OFF CACHE BOOL "" FORCE)
set(ENABLE_XATTR OFF CACHE BOOL "" FORCE)
set(ENABLE_ACL OFF CACHE BOOL "" FORCE)
set(ENABLE_ICONV OFF CACHE BOOL "" FORCE)
set(ENABLE_TEST OFF CACHE BOOL "" FORCE)
set(ENABLE_INSTALL OFF CACHE BOOL "" FORCE)
set(ENABLE_WERROR OFF CACHE BOOL "" FORCE)
add_subdirectory(third_party/libarchive-3.8.11 libarchive_build EXCLUDE_FROM_ALL)

# A biblioteca sem interface gráfica permite testar persistência de janela em headless.
qt_add_library(gamestock_core STATIC
    src/app/WindowState.cpp src/app/WindowState.h src/app/DataPaths.cpp src/app/DataPaths.h
    src/app/ChannelIdentity.cpp src/app/ChannelIdentity.h
    src/app/ProfileLock.cpp src/app/ProfileLock.h
    src/app/ExecutableResolver.cpp src/app/ExecutableResolver.h
    src/app/RetroArchCores.cpp src/app/RetroArchCores.h
    src/app/RomLaunchExtraction.cpp src/app/RomLaunchExtraction.h
    src/app/RomFolderScanner.cpp src/app/RomFolderScanner.h
    src/db/RetroArchCatalogData.cpp src/db/RetroArchCatalogData.h
    src/db/ReadOnlyConnection.cpp src/db/ReadOnlyConnection.h src/db/dao/GameReadDao.cpp src/db/dao/GameReadDao.h
    src/db/dao/GameWriteDao.cpp src/db/dao/GameWriteDao.h
    src/db/dao/RomFolderDao.cpp src/db/dao/RomFolderDao.h
    src/db/dao/EmulatorDao.cpp src/db/dao/EmulatorDao.h
    src/db/dao/PlatformEmulatorDao.cpp src/db/dao/PlatformEmulatorDao.h
    src/db/dao/HardwareItemDao.cpp src/db/dao/HardwareItemDao.h
    src/db/dao/HardwareItemPhotoDao.cpp src/db/dao/HardwareItemPhotoDao.h
    src/db/dao/HardwareItemTypeDao.cpp src/db/dao/HardwareItemTypeDao.h
    src/db/dao/HardwareConservationStateDao.cpp src/db/dao/HardwareConservationStateDao.h
    src/db/dao/PortabilityDao.cpp src/db/dao/PortabilityDao.h
    src/db/WriteConnection.cpp src/db/WriteConnection.h src/db/dao/PlatformDao.cpp src/db/dao/PlatformDao.h
    src/db/dao/AppStateReadDao.cpp src/db/dao/AppStateReadDao.h src/db/LegacyJobState.cpp src/db/LegacyJobState.h
    src/db/dao/AppStateWriteDao.cpp src/db/dao/AppStateWriteDao.h src/db/JobStateStore.cpp src/db/JobStateStore.h
    src/db/FolderStateStore.cpp src/db/FolderStateStore.h src/db/LibraryFilterState.cpp src/db/LibraryFilterState.h
    src/db/Schema.cpp src/db/Schema.h src/db/LibraryGrouping.cpp src/db/LibraryGrouping.h
    src/db/PlatformCatalogData.cpp src/db/PlatformCatalogData.h src/db/Seeds.cpp src/db/Seeds.h
    src/db/Migrations.cpp src/db/Migrations.h src/db/Database.cpp src/db/Database.h
    src/launchbox/LaunchBoxCache.cpp src/launchbox/LaunchBoxCache.h
    src/launchbox/LaunchBoxSearch.cpp src/launchbox/LaunchBoxSearch.h
    src/launchbox/LibretroClient.cpp src/launchbox/LibretroClient.h
    src/launchbox/OpenVgdb.cpp src/launchbox/OpenVgdb.h
    src/launchbox/MetadataSearch.cpp src/launchbox/MetadataSearch.h
    src/launchbox/LaunchBoxMedia.cpp src/launchbox/LaunchBoxMedia.h
    src/launchbox/LibretroMedia.cpp src/launchbox/LibretroMedia.h
    src/portability/ZipArchive.cpp src/portability/ZipArchive.h
    src/portability/CompatibleZipWriter.cpp src/portability/CompatibleZipWriter.h
    src/update/UpdateSignature.cpp src/update/UpdateSignature.h
    src/update/UpdateManifest.cpp src/update/UpdateManifest.h
    src/update/UpdateService.cpp src/update/UpdateService.h
    src/portability/PortableManifest.cpp src/portability/PortableManifest.h
    src/models/GameListModel.cpp src/models/GameListModel.h
    src/models/PlatformListModel.cpp src/models/PlatformListModel.h
    src/models/EmulatorListModel.cpp src/models/EmulatorListModel.h
    src/models/HardwareItemListModel.cpp src/models/HardwareItemListModel.h
    src/models/JobListModel.cpp src/models/JobListModel.h
    src/services/GameService.cpp src/services/GameService.h
    src/services/PlatformService.cpp src/services/PlatformService.h
    src/services/EmulatorService.cpp src/services/EmulatorService.h
    src/services/LaunchService.cpp src/services/LaunchService.h
    src/services/RomFolderService.cpp src/services/RomFolderService.h
    src/services/MediaSyncService.cpp src/services/MediaSyncService.h
    src/services/MetadataService.cpp src/services/MetadataService.h
    src/services/InventoryPreferences.cpp src/services/InventoryPreferences.h
    src/services/InventoryService.cpp src/services/InventoryService.h
    src/services/SettingsService.cpp src/services/SettingsService.h
    src/services/BackupService.cpp src/services/BackupService.h
    src/services/BackupCoordinator.cpp src/services/BackupCoordinator.h
    src/jobs/JobRegistry.cpp src/jobs/JobRegistry.h
    src/jobs/JobWorker.cpp src/jobs/JobWorker.h
    src/jobs/JobManager.cpp src/jobs/JobManager.h
)
target_compile_features(gamestock_core PUBLIC cxx_std_20)
target_include_directories(gamestock_core PUBLIC src)
target_compile_definitions(gamestock_core PRIVATE LIBARCHIVE_STATIC)
target_link_libraries(gamestock_core PUBLIC Qt6::Core Qt6::Sql Qt6::Network Qt6::Gui archive_static)
if(WIN32)
    # BCrypt valida a assinatura ECDSA P-256 do manifesto de atualização.
    target_link_libraries(gamestock_core PRIVATE bcrypt)
endif()

qt_add_executable(gamestock_native src/app/main.cpp)
target_sources(gamestock_native PRIVATE src/app/MediaReader.cpp src/app/MediaReader.h src/app/FixtureLibrary.cpp src/app/FixtureLibrary.h)
target_compile_features(gamestock_native PRIVATE cxx_std_20)
target_link_libraries(gamestock_native PRIVATE gamestock_core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::QuickControls2 Qt6::Svg Qt6::QuickDialogs2)
if(WIN32)
    # Psapi mede memória; DWM aplica a barra de título escura da janela nativa.
    target_link_libraries(gamestock_native PRIVATE psapi dwmapi)
endif()
# O identificador de commit é opcional para builds a partir de arquivos sem Git.
find_package(Git QUIET)
if(Git_FOUND)
    execute_process(COMMAND "${GIT_EXECUTABLE}" rev-parse --short=7 HEAD
        WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
        OUTPUT_VARIABLE GAMESTOCK_BUILD_COMMIT OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET RESULT_VARIABLE git_result)
endif()
if(NOT git_result EQUAL 0 OR NOT GAMESTOCK_BUILD_COMMIT MATCHES "^[0-9a-fA-F]+$")
    set(GAMESTOCK_BUILD_COMMIT "")
endif()
target_compile_definitions(gamestock_native PRIVATE GAMESTOCK_VERSION="${PROJECT_VERSION}" GAMESTOCK_BUILD_COMMIT="${GAMESTOCK_BUILD_COMMIT}")

# Um singleton concentra tokens, evitando diferenças de tema entre telas.
set_source_files_properties(qml/Theme.qml PROPERTIES QT_QML_SINGLETON_TYPE TRUE)
qt_add_qml_module(gamestock_native
    URI GameStock
    VERSION 1.0
    RESOURCE_PREFIX /qt/qml
    QML_FILES
        qml/Main.qml qml/Theme.qml
        # A abertura é carregada antes do banco, sem depender da janela principal.
        qml/StartupSplash.qml
        # Primitivas visuais compartilham métricas CSS e rasterização da fonte no Windows.
        qml/components/UiText.qml qml/components/SectionIntro.qml qml/components/CollectionScrollBar.qml
        qml/components/FormCheckBox.qml qml/components/PanelFlickable.qml
        # O seletor compartilhado preserva métricas e menu escuro em todos os formulários.
        qml/components/ActionButton.qml qml/components/FormField.qml qml/components/FormSelect.qml qml/components/NavigationButton.qml
        qml/components/DragDialog.qml qml/components/GameCard.qml qml/components/GameListLine.qml
        qml/components/GameDetailPage.qml qml/components/GameFormDialog.qml
        qml/components/GameMetadataEditor.qml
        qml/components/GameVersionDialog.qml qml/components/ConfirmDialog.qml
        qml/components/PlatformManager.qml qml/components/PlatformFormDialog.qml qml/components/PlatformMappingsDialog.qml
        qml/components/EmulatorManager.qml qml/components/EmulatorFormDialog.qml
        qml/components/EmulatorLinkDialog.qml qml/components/RetroArchCoresDialog.qml
        qml/components/PlayHistorySettings.qml
        qml/components/RomFolderImporter.qml qml/components/NotificationCenter.qml
        qml/components/CoverSyncSettings.qml qml/components/LaunchBoxImporter.qml
        qml/components/HardwareItemCard.qml qml/components/InventoryListLine.qml
        qml/components/HardwareCatalogSelector.qml qml/components/HardwareItemFormDialog.qml
        qml/components/HardwareItemDetailPage.qml qml/components/HardwareInventoryPage.qml
        qml/components/LogsSettings.qml qml/components/AboutSettings.qml
        qml/components/DataPortabilitySettings.qml
        qml/components/SplashOverlay.qml
    # Ícones em tamanhos nativos mantêm nitidez na barra de título e na barra de tarefas.
    RESOURCES assets/logo.png assets/favicon-16x16.png assets/favicon-32x32.png assets/favicon-96x96.png
)

# Ícones locais são dados de desenho, sem componente React no runtime nativo.
file(GLOB icon_files CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/assets/*.svg")
qt_add_resources(gamestock_native icons PREFIX /icons BASE assets FILES ${icon_files})

# Fontes Inter locais permitem usar a mesma tipografia mesmo sem conexão à internet.
file(GLOB inter_font_files CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/assets/fonts/*.ttf")
qt_add_resources(gamestock_native fonts PREFIX /fonts BASE assets/fonts FILES ${inter_font_files})

# Avisos por target respeitam as diferenças entre MSVC e GCC/Clang.
foreach(target IN ITEMS gamestock_core gamestock_native)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4 /permissive- /utf-8)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)
    endif()
endforeach()

if(BUILD_TESTING)
    qt_add_executable(window_state_tests tests/WindowStateTest.cpp)
    target_link_libraries(window_state_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME window-state COMMAND window_state_tests)
    # As fixtures usam apenas diretórios temporários, nunca o perfil real.
    qt_add_executable(data_paths_tests tests/DataPathsTest.cpp src/app/MediaReader.cpp src/app/MediaReader.h)
    target_link_libraries(data_paths_tests PRIVATE gamestock_core Qt6::Test Qt6::Gui)
    add_test(NAME data-paths COMMAND data_paths_tests)
    # Canal instalado/portátil usa apenas arquivos/marcadores temporários.
    qt_add_executable(channel_identity_tests tests/ChannelIdentityTest.cpp)
    target_link_libraries(channel_identity_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME channel-identity COMMAND channel_identity_tests)
    # A abertura de teste é apenas leitura e não aplica migrations.
    qt_add_executable(read_only_connection_tests tests/ReadOnlyConnectionTest.cpp)
    target_link_libraries(read_only_connection_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME read-only-connection COMMAND read_only_connection_tests)
    qt_add_executable(game_read_dao_tests tests/GameReadDaoTest.cpp)
    target_link_libraries(game_read_dao_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME game-read-dao COMMAND game_read_dao_tests)
    qt_add_executable(fixture_library_tests tests/FixtureLibraryTest.cpp src/app/FixtureLibrary.cpp src/app/FixtureLibrary.h)
    target_link_libraries(fixture_library_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME fixture-library COMMAND fixture_library_tests)
    qt_add_executable(legacy_job_state_tests tests/LegacyJobStateTest.cpp)
    target_link_libraries(legacy_job_state_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME legacy-job-state COMMAND legacy_job_state_tests)
    qt_add_executable(job_registry_tests tests/JobRegistryTest.cpp)
    target_link_libraries(job_registry_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME job-registry COMMAND job_registry_tests)
    qt_add_executable(job_manager_tests tests/JobManagerTest.cpp)
    target_link_libraries(job_manager_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME job-manager COMMAND job_manager_tests)
    qt_add_executable(launchbox_cache_tests tests/LaunchBoxCacheTest.cpp)
    target_link_libraries(launchbox_cache_tests PRIVATE gamestock_core Qt6::Test Qt6::Network)
    add_test(NAME launchbox-cache COMMAND launchbox_cache_tests)
    qt_add_executable(metadata_search_tests tests/MetadataSearchTest.cpp)
    target_link_libraries(metadata_search_tests PRIVATE gamestock_core Qt6::Test Qt6::Network)
    add_test(NAME metadata-search COMMAND metadata_search_tests)
    qt_add_executable(launchbox_media_tests tests/LaunchBoxMediaTest.cpp)
    target_link_libraries(launchbox_media_tests PRIVATE gamestock_core Qt6::Test Qt6::Network Qt6::Gui)
    add_test(NAME launchbox-media COMMAND launchbox_media_tests)
    qt_add_executable(libretro_media_tests tests/LibretroMediaTest.cpp)
    target_link_libraries(libretro_media_tests PRIVATE gamestock_core Qt6::Test Qt6::Network Qt6::Gui)
    add_test(NAME libretro-media COMMAND libretro_media_tests)
    if(WIN32)
        set_tests_properties(launchbox-cache metadata-search PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${CMAKE_CURRENT_SOURCE_DIR}/third_party/7zip/win/x64/7za.exe")
    else()
        set_tests_properties(launchbox-cache metadata-search PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${GAMESTOCK_7Z_EXECUTABLE}")
    endif()
    # O teste de migrations usa apenas bancos temporários e a fixture via variável de ambiente.
    qt_add_executable(migrations_tests tests/MigrationsTest.cpp)
    target_link_libraries(migrations_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME migrations COMMAND migrations_tests)
    # Snapshot, schema futuro e rollback usam cópias temporárias, nunca o perfil real.
    qt_add_executable(snapshot_tests tests/SnapshotTest.cpp)
    target_link_libraries(snapshot_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME snapshot COMMAND snapshot_tests)
    qt_add_executable(profile_lock_tests tests/ProfileLockTest.cpp)
    target_link_libraries(profile_lock_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME profile-lock COMMAND profile_lock_tests)
    qt_add_executable(game_write_dao_tests tests/GameWriteDaoTest.cpp)
    target_link_libraries(game_write_dao_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME game-write-dao COMMAND game_write_dao_tests)
    qt_add_executable(game_service_tests tests/GameServiceTest.cpp)
    target_link_libraries(game_service_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME game-service COMMAND game_service_tests)
    qt_add_executable(platform_service_tests tests/PlatformServiceTest.cpp)
    target_link_libraries(platform_service_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME platform-service COMMAND platform_service_tests)
    # Scan/importação usam pastas e banco temporários, nunca o perfil real.
    qt_add_executable(rom_folder_tests tests/RomFolderTest.cpp)
    target_link_libraries(rom_folder_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME rom-folder COMMAND rom_folder_tests)
    # Sincronização de mídia usa servidor HTTP local e 7-Zip de teste.
    qt_add_executable(media_sync_tests tests/MediaSyncTest.cpp)
    target_link_libraries(media_sync_tests PRIVATE gamestock_core Qt6::Test Qt6::Network Qt6::Gui)
    add_test(NAME media-sync COMMAND media_sync_tests)
    if(WIN32)
        set_tests_properties(media-sync PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${CMAKE_CURRENT_SOURCE_DIR}/third_party/7zip/win/x64/7za.exe")
    else()
        set_tests_properties(media-sync PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${GAMESTOCK_7Z_EXECUTABLE}")
    endif()
    qt_add_executable(metadata_service_tests tests/MetadataServiceTest.cpp)
    target_link_libraries(metadata_service_tests PRIVATE gamestock_core Qt6::Test Qt6::Network Qt6::Gui)
    add_test(NAME metadata-service COMMAND metadata_service_tests)
    if(WIN32)
        set_tests_properties(metadata-service PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${CMAKE_CURRENT_SOURCE_DIR}/third_party/7zip/win/x64/7za.exe")
    else()
        set_tests_properties(metadata-service PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${GAMESTOCK_7Z_EXECUTABLE}")
    endif()
    qt_add_executable(view_state_tests tests/ViewStateTest.cpp)
    target_link_libraries(view_state_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME view-state COMMAND view_state_tests)
    qt_add_executable(emulator_service_tests tests/EmulatorServiceTest.cpp)
    target_link_libraries(emulator_service_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME emulator-service COMMAND emulator_service_tests)
    # Inventário usa banco e perfil temporários; nenhuma foto real é tocada.
    qt_add_executable(hardware_inventory_tests tests/HardwareInventoryTest.cpp)
    target_link_libraries(hardware_inventory_tests PRIVATE gamestock_core Qt6::Test Qt6::Gui)
    add_test(NAME hardware-inventory COMMAND hardware_inventory_tests)
    # Logs e estatísticas usam perfil temporário e cache isolado por variável de ambiente.
    qt_add_executable(settings_service_tests tests/SettingsServiceTest.cpp)
    target_link_libraries(settings_service_tests PRIVATE gamestock_core Qt6::Test)
    add_test(NAME settings-service COMMAND settings_service_tests)
    # ZIP/ZIP64 e manifesto usam arquivos temporários, sem tocar em backups reais.
    qt_add_executable(portable_archive_tests tests/PortableArchiveTest.cpp)
    target_link_libraries(portable_archive_tests PRIVATE gamestock_core Qt6::Test)
    target_compile_definitions(portable_archive_tests PRIVATE
        GAMESTOCK_TEST_FIXTURES="${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures")
    add_test(NAME portable-archive COMMAND portable_archive_tests)
    # Portabilidade usa perfil/banco temporários e a fixture generate pelo Electron.
    qt_add_executable(backup_service_tests tests/BackupServiceTest.cpp)
    target_link_libraries(backup_service_tests PRIVATE gamestock_core Qt6::Test Qt6::Gui)
    target_compile_definitions(backup_service_tests PRIVATE
        GAMESTOCK_TEST_FIXTURES="${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures")
    add_test(NAME backup-service COMMAND backup_service_tests)
    # Coordenação em threads reais: exportação/importação viram jobs com progresso e persistência.
    qt_add_executable(backup_coordinator_tests tests/BackupCoordinatorTest.cpp)
    target_link_libraries(backup_coordinator_tests PRIVATE gamestock_core Qt6::Test Qt6::Gui)
    add_test(NAME backup-coordinator COMMAND backup_coordinator_tests)
    # Emulador falso grava argv para comprovar argumentos e incremento só no sucesso.
    add_executable(fake_emulator tests/FakeEmulator.cpp)
    if(WIN32)
        target_link_libraries(fake_emulator PRIVATE shell32)
    endif()
    # Assinatura/updater usam feed HTTP local e um aplicador falso.
    qt_add_executable(update_tests tests/UpdateTest.cpp)
    target_link_libraries(update_tests PRIVATE gamestock_core Qt6::Test Qt6::Network)
    target_compile_definitions(update_tests PRIVATE GAMESTOCK_FAKE_EMULATOR="$<TARGET_FILE:fake_emulator>")
    add_dependencies(update_tests fake_emulator)
    add_test(NAME update-service COMMAND update_tests)
    qt_add_executable(launch_service_tests tests/LaunchServiceTest.cpp)
    target_link_libraries(launch_service_tests PRIVATE gamestock_core Qt6::Test)
    add_dependencies(launch_service_tests fake_emulator)
    add_test(NAME launch-service COMMAND launch_service_tests)
    if(WIN32)
        set_tests_properties(launch-service PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${CMAKE_CURRENT_SOURCE_DIR}/third_party/7zip/win/x64/7za.exe")
    else()
        set_tests_properties(launch-service PROPERTIES ENVIRONMENT
            "GAMESTOCK_7Z_PATH=${GAMESTOCK_7Z_EXECUTABLE}")
    endif()
endif()

install(TARGETS gamestock_native RUNTIME DESTINATION bin)

# Ferramenta de benchmark local (não entra no instalador).
add_executable(native_benchmark tools/NativeBenchmark.cpp)
target_link_libraries(native_benchmark PRIVATE gamestock_core)
if(WIN32)
    target_link_libraries(native_benchmark PRIVATE psapi)
endif()
