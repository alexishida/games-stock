/** Compatibilidade de window-bounds.json, sem dependência da camada gráfica Qt. */
#include "WindowState.h"

#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSaveFile>
#include <algorithm>
#include <limits>

namespace gamestock {
namespace {

/** Limites iguais ao aplicativo existente; unidades são pixels lógicos. */
constexpr int initialWidth = 1122;
constexpr int initialHeight = 957;
constexpr int minimumWidth = 1024;
constexpr int minimumHeight = 768;

/** Evita conversões indefinidas de valores externos fora da faixa de int. */
bool isInteger(const QJsonValue& value) {
    const double number = value.toDouble(std::numeric_limits<double>::quiet_NaN());
    return number >= std::numeric_limits<int>::min()
        && number <= std::numeric_limits<int>::max()
        && number == static_cast<double>(static_cast<int>(number));
}

} // namespace

QRect visibleWindowGeometry(const QRect& stored, const QList<QRect>& screens) {
    const QList<QRect> available = screens.isEmpty() ? QList<QRect>{QRect(0, 0, 1920, 1080)} : screens;
    QRect target = available.first();
    qint64 largestIntersection = 0;
    for (const auto& screen : available) {
        const QRect intersection = screen.intersected(stored);
        const qint64 area = static_cast<qint64>(intersection.width()) * intersection.height();
        if (!intersection.isEmpty() && area > largestIntersection) {
            target = screen;
            largestIntersection = area;
        }
    }
    const int width = std::min(std::max(stored.width(), minimumWidth), target.width());
    const int height = std::min(std::max(stored.height(), minimumHeight), target.height());
    // Sem interseção, recentralizar é mais útil que encostar a janela na borda do monitor.
    const int x = largestIntersection > 0 ? std::clamp(stored.x(), target.left(), target.right() - width + 1) : target.x() + (target.width() - width) / 2;
    const int y = largestIntersection > 0 ? std::clamp(stored.y(), target.top(), target.bottom() - height + 1) : target.y() + (target.height() - height) / 2;
    return {x, y, width, height};
}

QSize contentSizeForFrame(const QSize& frameSize, const QMargins& margins) {
    // Electron salva a janela externa; Qt dimensiona a área útil sem a moldura nativa.
    return {std::max(1, frameSize.width() - margins.left() - margins.right()),
            std::max(1, frameSize.height() - margins.top() - margins.bottom())};
}

QRect loadWindowGeometry(const QString& filePath, const QList<QRect>& screens) {
    QFile file(filePath);
    QJsonObject object;
    if (file.open(QIODevice::ReadOnly)) object = QJsonDocument::fromJson(file.readAll()).object();
    // Limites de domínio também evitam overflow na representação interna de QRect.
    const int width = isInteger(object.value("width")) && object.value("width").toInt() > 0 && object.value("width").toInt() <= 32768 ? object.value("width").toInt() : initialWidth;
    const int height = isInteger(object.value("height")) && object.value("height").toInt() > 0 && object.value("height").toInt() <= 32768 ? object.value("height").toInt() : initialHeight;
    if (!isInteger(object.value("x")) || !isInteger(object.value("y")) || qAbs(object.value("x").toDouble()) > 1000000 || qAbs(object.value("y").toDouble()) > 1000000) {
        // Uma posição sentinela fora dos monitores mantém a centralização inicial explícita.
        const QRect geometry = visibleWindowGeometry({0, 0, width, height}, screens);
        const QRect screen = screens.isEmpty() ? QRect(0, 0, 1920, 1080) : screens.first();
        return {screen.x() + (screen.width() - geometry.width()) / 2, screen.y() + (screen.height() - geometry.height()) / 2, geometry.width(), geometry.height()};
    }
    return visibleWindowGeometry({object.value("x").toInt(), object.value("y").toInt(), width, height}, screens);
}

bool saveWindowGeometry(const QString& filePath, const QRect& geometry) {
    QSaveFile file(filePath);
    if (!file.open(QIODevice::WriteOnly)) return false;
    const QJsonObject object{{"x", geometry.x()}, {"y", geometry.y()}, {"width", geometry.width()}, {"height", geometry.height()}};
    const QByteArray bytes = QJsonDocument(object).toJson();
    return file.write(bytes) == bytes.size() && file.commit();
}

} // namespace gamestock
