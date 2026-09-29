import QtQuick
import Quickshell
import Quickshell.Io
import qs.Modules.Plugins
import qs.Common

// NyxRings — a fully transparent desktop widget that renders a "wave_rings"
// audio visualizer (concentric rings + polar spectrum) driven by cava.
DesktopPluginComponent {
    id: root

    implicitWidth: 300
    implicitHeight: 300
    minWidth: 120
    minHeight: 120

    // Defaults match the original visualizer's WaveRings mode.
    property real sensitivity: 1.5
    property real rotationSpeed: 0.5
    property real ringOpacity: 0.8
    property real bloomIntensity: 0.5
    property real waveThickness: 1.0
    property real innerDiameter: 0.7

    // fadeWhenIdle: the widget fades out when nothing is playing.
    property bool fadeWhenIdle: true
    property real _lastActiveMs: 0
    property bool idle: false

    property color primaryColor: Theme.primary
    property color secondaryColor: Theme.secondary

    property var bands: {
        const a = [];
        for (let i = 0; i < 32; i++)
            a.push(0);
        return a;
    }

    readonly property string instanceKey: (root.instanceId && root.instanceId.length > 0) ? root.instanceId : "default"
    readonly property string cavaConf: Quickshell.cachePath("nyxrings-" + root.instanceKey + ".conf")

    function consume(line) {
        if (!line)
            return;
        const parts = line.split(";");
        if (parts.length < 32)
            return;
        const out = [];
        for (let i = 0; i < 32; i++) {
            let v = parseInt(parts[i]);
            if (isNaN(v))
                v = 0;
            out.push(Math.min(Math.max(v, 0), 1000) / 1000);
        }
        root.bands = out;
        let peak = 0;
        for (let i = 0; i < 32; i++)
            peak = Math.max(peak, out[i]);
        if (peak > 0.02)
            root._lastActiveMs = Date.now();
    }

    Item {
        anchors.fill: parent
        opacity: (root.fadeWhenIdle && root.idle) ? 0 : 1

        Behavior on opacity {
            NumberAnimation { duration: 700; easing.type: Easing.InOutQuad }
        }

        Timer {
            interval: 400
            running: true
            repeat: true
            onTriggered: root.idle = (Date.now() - root._lastActiveMs > 2000)
        }

        FileView {
            id: cavaConfFile
            path: root.cavaConf
            preload: false
            blockWrites: true
            atomicWrites: true
        }

        Process {
            id: cava
            command: ["sh", "-c", "exec cava -p '" + root.cavaConf + "'"]
            running: true
            stdout: SplitParser {
                splitMarker: "\n"
                onRead: line => root.consume(line)
            }
        }

        ShaderEffect {
            id: fx
            anchors.fill: parent
            fragmentShader: Qt.resolvedUrl("wave-rings.frag.qsb")
            blending: true

            property real u_time: 0
            property real u_aspect: width / Math.max(height, 1)
            property real u_sensitivity: root.sensitivity
            property real u_rotation_speed: root.rotationSpeed
            property real u_ring_opacity: root.ringOpacity
            property real u_bloom_intensity: root.bloomIntensity
            property real u_wave_thickness: root.waveThickness
            property real u_inner_diameter: root.innerDiameter
            property vector4d u_primary: Qt.vector4d(root.primaryColor.r, root.primaryColor.g, root.primaryColor.b, root.primaryColor.a)
            property vector4d u_secondary: Qt.vector4d(root.secondaryColor.r, root.secondaryColor.g, root.secondaryColor.b, root.secondaryColor.a)
            property vector4d u_b0: Qt.vector4d(root.bands[0] || 0, root.bands[1] || 0, root.bands[2] || 0, root.bands[3] || 0)
            property vector4d u_b1: Qt.vector4d(root.bands[4] || 0, root.bands[5] || 0, root.bands[6] || 0, root.bands[7] || 0)
            property vector4d u_b2: Qt.vector4d(root.bands[8] || 0, root.bands[9] || 0, root.bands[10] || 0, root.bands[11] || 0)
            property vector4d u_b3: Qt.vector4d(root.bands[12] || 0, root.bands[13] || 0, root.bands[14] || 0, root.bands[15] || 0)
            property vector4d u_b4: Qt.vector4d(root.bands[16] || 0, root.bands[17] || 0, root.bands[18] || 0, root.bands[19] || 0)
            property vector4d u_b5: Qt.vector4d(root.bands[20] || 0, root.bands[21] || 0, root.bands[22] || 0, root.bands[23] || 0)
            property vector4d u_b6: Qt.vector4d(root.bands[24] || 0, root.bands[25] || 0, root.bands[26] || 0, root.bands[27] || 0)
            property vector4d u_b7: Qt.vector4d(root.bands[28] || 0, root.bands[29] || 0, root.bands[30] || 0, root.bands[31] || 0)
        }

        FrameAnimation {
            running: true
            onTriggered: fx.u_time += frameTime
        }
    }

    Component.onCompleted: {
        cavaConfFile.setText(
            "[general]\n" +
            "bars = 32\n" +
            "framerate = 60\n" +
            "autosens = 0\n" +
            "sensitivity = 100\n" +
            "[output]\n" +
            "method = raw\n" +
            "raw_target = /dev/stdout\n" +
            "data_format = ascii\n" +
            "ascii_max_range = 1000\n" +
            "bar_delimiter = 59\n" +
            "frame_delimiter = 10\n" +
            "channels = mono\n" +
            "mono_option = average\n" +
            "[smoothing]\n" +
            "noise_reduction = 77\n" +
            "monstercat = 1.2\n");
    }
}
