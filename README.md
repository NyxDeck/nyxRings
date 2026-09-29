# NyxRings

A [DankMaterialShell](https://github.com/AvengeMedia/DankMaterialShell)
desktop widget: a fully transparent audio visualizer rendering the **wave_rings**
effect — concentric rings and a polar spectrum around an empty centre.

The widget draws nothing where there is no ring or wave, so it floats on the
wallpaper without covering it.

## Requirements

- DankMaterialShell 1.6.1 or newer
- `cava`
- `qt6-shadertools` (only to rebuild the shader)

## Install

Until the plugin is in the registry, install it manually:

```bash
git clone https://github.com/NyxDeck/nyxRings.git \
    ~/.config/DankMaterialShell/plugins/nyxRings
dms restart
```

DMS never places plugin desktop widgets automatically. Add one instance under
**Settings → Desktop Widgets → NyxRings**, then drag and resize it.

## Settings

The widget has no settings page; its appearance is set by the top-level
properties in `NyxRings.qml`. The defaults match the original WaveRings mode:

| property | default | meaning |
|---|---|---|
| `sensitivity` | 1.5 | audio gain applied to the spectrum |
| `rotationSpeed` | 0.5 | rotation of the wave and the ring grid |
| `ringOpacity` | 0.8 | opacity of the ring elements |
| `bloomIntensity` | 0.5 | strength of the glow |
| `waveThickness` | 1.0 | thickness of the polar wave |
| `innerDiameter` | 0.7 | inner diameter of the ring system |
| `fadeWhenIdle` | true | fade out after two seconds without audio |

The colours follow the theme's `primary` and `secondary`.

## How it works

- The widget runs its own `cava` process configured for **32 bands**, parses
  its raw output, and feeds the values to the shader as eight `vec4` uniforms.
- `wave-rings.frag` is the ported fragment shader (GLSL 450, Qt6
  `ShaderEffect` uniform block). `wave-rings.frag.qsb` is the compiled form.
- Rebuild the shader after editing it:

  ```bash
  qsb --qt6 -o wave-rings.frag.qsb wave-rings.frag
  ```

## Credits

`wave-rings.frag` is a port of the `fancy_audio_visualizer` fragment shader
from [Noctalia](https://github.com/noctalia-dev/noctalia) (MIT). The rendering
formulas, defaults, and the nearest-filtered 32-band spectrum model are kept
as in the original.

## License

MIT. See [LICENSE](LICENSE).
