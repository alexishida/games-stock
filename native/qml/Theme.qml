/* Tokens efetivos do renderer; manter referência em docs/native-migration/decisions.md. */
pragma Singleton
import QtQuick

QtObject {
    readonly property color background: "#131313"
    readonly property color sidebar: "#d11c1b1b"
    readonly property color panel: "#201f1f"
    readonly property color card: "#2a2a2a"
    readonly property color elevated: "#353534"
    readonly property color control: "#0affffff"
    readonly property color controlHover: "#0fffffff"
    readonly property color glass: "#d1201f1f"
    readonly property color cardHover: "#1400f2ff"
    readonly property color accent: "#00f2ff"
    readonly property color accentMuted: "#74f5ff"
    readonly property color accentSoft: "#2400f2ff"
    readonly property color accentForeground: "#002022"
    readonly property color text: "#e5e2e1"
    readonly property color secondary: "#b9cacb"
    readonly property color muted: "#849495"
    readonly property color border: "#38849495"
    readonly property color borderStrong: "#66849495"
    /* Estados semânticos do formulário de jogo, medidos no CSS de referência. */
    readonly property color success: "#4ade80"
    readonly property color successSoft: "#1f22c55e"
    readonly property color warning: "#fbbf24"
    readonly property color warningSoft: "#3d78350f"
    readonly property color danger: "#ff8a80"
    /* Sombras efetivas de global.css; medidas em docs/native-migration/windows-effects.md. */
    readonly property color shadowElevatedColor: "#80000000"
    readonly property int shadowElevatedBlur: 30
    /* MultiEffect medido: 60 reproduz o perfil do box-shadow de 30 px. */
    readonly property int shadowElevatedBlurMax: 60
    readonly property int shadowElevatedOffsetY: 10
    readonly property color shadowModalColor: "#94000000"
    readonly property int shadowModalBlur: 80
    /* Limite prático do MultiEffect; 128 é o maior raio que ainda desenha a sombra. */
    readonly property int shadowModalBlurMax: 128
    readonly property int shadowModalOffsetY: 24
    /* TopBar: box-shadow 0 8px 24px rgba(0,0,0,0.18). */
    readonly property color shadowTopbarColor: "#2e000000"
    readonly property int shadowTopbarBlur: 24
    readonly property int shadowTopbarBlurMax: 48
    readonly property int shadowTopbarOffsetY: 8
    /* modal-backdrop: blur(8px) com scrim 0.68; camada empilhada usa 4px e 0.46. */
    readonly property int backdropBlurRadius: 8
    /* MultiEffect medido: 32 reproduz o blur(8px) do Chromium. */
    readonly property int backdropBlurMax: 32
    /* Overlays secundários do gerenciamento usam blur(8px) no CSS efetivo. */
    readonly property int stackedBackdropBlurMax: 32
    readonly property color scrim: "#ad000000"
    readonly property color stackedScrim: "#75000000"
    /* Inter é distribuída no aplicativo para garantir leitura consistente também offline. */
    readonly property string fontFamily: "Inter"
    readonly property string heavyFontFamily: fontFamily
    /** Inter oferece variantes para todos os pesos usados pela interface. */
    function cssFontWeight(weight) { return weight }
    readonly property int sidebarWidth: 240
    readonly property int controlHeight: 34
    readonly property int modalTitleGap: 28
    readonly property int formControlFontSize: 13
    readonly property int formLabelFontSize: 12
    /* Medidas de global.css: label/campo 8 px, grupos 16 px e ações com gap 10 px. */
    readonly property int formLabelGap: 8
    readonly property int formGroupGap: 16
    readonly property int formActionGap: 10
    readonly property int formActionMinWidth: 94
    /* Medidas obtidas por getComputedStyle/getBoundingClientRect no Electron, sem escala extra. */
    readonly property int navigationFontSize: 13
    readonly property int navigationCompactFontSize: 13
    readonly property int navigationCounterFontSize: 12
    readonly property int navigationSectionFontSize: 11
    readonly property int navigationRowHeight: 38
    readonly property int navigationCompactRowHeight: 32
    readonly property int navigationTreeRowHeight: 31
    readonly property int inventoryCardTitleFontSize: 13
    readonly property int inventoryCardMetaFontSize: 12
    readonly property int libraryCardTitleFontSize: 14
    readonly property int libraryCardLabelFontSize: 11
}
