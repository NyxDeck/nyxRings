#version 450

// NyxRings — the "wave_rings" fragment shader (concentric rings + polar
// spectrum). Fully transparent: it writes premultiplied alpha and nothing where
// there is no ring or wave. Upstream notice: see LICENSE.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float u_time;
    float u_aspect;
    float u_sensitivity;
    float u_rotation_speed;
    float u_ring_opacity;
    float u_bloom_intensity;
    float u_wave_thickness;
    float u_inner_diameter;
    vec4 u_primary;
    vec4 u_secondary;
    vec4 u_b0;
    vec4 u_b1;
    vec4 u_b2;
    vec4 u_b3;
    vec4 u_b4;
    vec4 u_b5;
    vec4 u_b6;
    vec4 u_b7;
} ubuf;

#define TWOPI 6.28318530718
#define PI 3.14159265359
#define NBARS 32.0
#define MIN_VISUAL_RADIUS 0.35
#define MIN_VISUAL_THICKNESS 0.025
#define MAX_VISUAL_RADIUS 0.95

float bars[32];

void fillBars() {
    bars[0]  = ubuf.u_b0.x; bars[1]  = ubuf.u_b0.y; bars[2]  = ubuf.u_b0.z; bars[3]  = ubuf.u_b0.w;
    bars[4]  = ubuf.u_b1.x; bars[5]  = ubuf.u_b1.y; bars[6]  = ubuf.u_b1.z; bars[7]  = ubuf.u_b1.w;
    bars[8]  = ubuf.u_b2.x; bars[9]  = ubuf.u_b2.y; bars[10] = ubuf.u_b2.z; bars[11] = ubuf.u_b2.w;
    bars[12] = ubuf.u_b3.x; bars[13] = ubuf.u_b3.y; bars[14] = ubuf.u_b3.z; bars[15] = ubuf.u_b3.w;
    bars[16] = ubuf.u_b4.x; bars[17] = ubuf.u_b4.y; bars[18] = ubuf.u_b4.z; bars[19] = ubuf.u_b4.w;
    bars[20] = ubuf.u_b5.x; bars[21] = ubuf.u_b5.y; bars[22] = ubuf.u_b5.z; bars[23] = ubuf.u_b5.w;
    bars[24] = ubuf.u_b6.x; bars[25] = ubuf.u_b6.y; bars[26] = ubuf.u_b6.z; bars[27] = ubuf.u_b6.w;
    bars[28] = ubuf.u_b7.x; bars[29] = ubuf.u_b7.y; bars[30] = ubuf.u_b7.z; bars[31] = ubuf.u_b7.w;
}

// Nearest sampling, matching the original RGBA texture (TextureFilter::Nearest).
float getAudio(float pos) {
    int i = int(clamp(floor(clamp(pos, 0.0, 1.0) * NBARS), 0.0, NBARS - 1.0));
    return bars[i];
}

float smoothAudio(float pos) {
    float idx = pos * (NBARS - 1.0);
    float fracPart = fract(idx);
    float i0 = floor(idx) / (NBARS - 1.0);
    float i1 = ceil(idx) / (NBARS - 1.0);
    return mix(getAudio(i0), getAudio(i1), fracPart) * ubuf.u_sensitivity;
}

float getBass()    { return smoothAudio(0.05); }
float getMid()     { return smoothAudio(0.3); }
float getHighMid() { return smoothAudio(0.6); }
float getTreble()  { return smoothAudio(0.9); }

float visualBaseRadius(float innerRadius) {
    return max(MIN_VISUAL_RADIUS, innerRadius + MIN_VISUAL_THICKNESS);
}

float roundedBoxSDF(vec2 center, vec2 size, float radius) {
    vec2 q = abs(center) - size + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float catmullAudio(float mirroredPos) {
    float bandPos = mirroredPos * (NBARS - 1.0);
    float fband1 = floor(bandPos);
    float fband0 = max(fband1 - 1.0, 0.0);
    float fband2 = min(fband1 + 1.0, NBARS - 1.0);
    float fband3 = min(fband1 + 2.0, NBARS - 1.0);

    float t = fract(bandPos);
    float p0 = getAudio(fband0 / (NBARS - 1.0)) * ubuf.u_sensitivity;
    float p1 = getAudio(fband1 / (NBARS - 1.0)) * ubuf.u_sensitivity;
    float p2 = getAudio(fband2 / (NBARS - 1.0)) * ubuf.u_sensitivity;
    float p3 = getAudio(fband3 / (NBARS - 1.0)) * ubuf.u_sensitivity;

    float t2 = t * t;
    float t3 = t2 * t;
    float smoothed = 0.5 * (
        (2.0 * p1) +
        (-p0 + p2) * t +
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
        (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    );
    return max(smoothed, 0.0);
}

void addRings(inout vec4 color, float theta, float d, float iTime, float bass, float mid, float highMid, float treble) {
    float innerRadius = ubuf.u_inner_diameter / 2.0;

    if (d < innerRadius * 0.6) {
        float wave = mid * 0.8;
        float ripple = sin(d * 25.0 + wave * 15.0 - iTime * 2.0);
        if (ripple > 0.7) {
            float intensity = clamp(mid * 0.6, 0.0, 0.4);
            color = max(color, ubuf.u_secondary * intensity * ubuf.u_ring_opacity);
        }
    }

    float energyRad = innerRadius * 0.65;
    float energyThickness = 0.015 + clamp(highMid * 0.02, 0.0, 0.03);
    if (d > energyRad - energyThickness && d < energyRad + energyThickness) {
        float segmentAngle = theta * 8.0 + highMid * 3.0 + iTime;
        if (mod(segmentAngle, 1.0) < 0.6) {
            float alpha = clamp(highMid * 2.0, 0.3, 1.0) * ubuf.u_ring_opacity;
            color = max(color, mix(ubuf.u_primary, ubuf.u_secondary, 0.5) * alpha);
        }
    }

    float particleRad = innerRadius * 0.75;
    if (d > particleRad - 0.02 && d < particleRad + 0.02) {
        float particleAngle = theta + treble * 2.0 + iTime * 0.5;
        float particleSpacing = TWOPI / 16.0;
        if (mod(particleAngle, particleSpacing) < 0.15) {
            float brightness = 0.5 + clamp(treble * 1.5, 0.0, 0.5);
            color = max(color, ubuf.u_secondary * brightness * ubuf.u_ring_opacity);
        }
    }

    float gridRad = innerRadius * 0.85;
    if (d > gridRad - 0.012 && d < gridRad + 0.012) {
        float gridAngle = theta + iTime * ubuf.u_rotation_speed;
        float gridDensity = 0.08 + clamp(mid * 0.05, 0.0, 0.1);
        if (mod(gridAngle, 0.2) < gridDensity) {
            vec4 gridColor = ubuf.u_primary * 0.7 * ubuf.u_ring_opacity;
            gridColor.rgb += vec3(0.1, 0.15, 0.2) * clamp(mid, 0.0, 0.8);
            color = max(color, gridColor);
        }
    }

    float accentRad = innerRadius * 0.92;
    float pulse = clamp(bass * 0.08, 0.0, 0.05);
    if (d > accentRad - pulse - 0.008 && d < accentRad + pulse + 0.015) {
        float colorShift = clamp(bass * 0.5, 0.0, 1.0);
        vec4 ringColor = mix(ubuf.u_secondary * 0.7, ubuf.u_primary, colorShift);
        ringColor.a = ubuf.u_ring_opacity * max(ubuf.u_primary.a, ubuf.u_secondary.a);
        ringColor.rgb *= 1.0 + bass * 0.3;
        color = max(color, ringColor);
    }

    float outerRad = innerRadius + bass * 0.05;
    if (d > outerRad - 0.008 && d < outerRad + 0.008) {
        vec4 outerColor = ubuf.u_primary * ubuf.u_ring_opacity;
        outerColor.rgb += vec3(0.2, 0.3, 0.4) * clamp(treble * 0.5, 0.0, 0.3);
        outerColor.rgb *= 1.0 + bass * 0.4;
        color = max(color, outerColor);
    }
}

vec4 computePolarWave(vec2 uv, float iTime, float bass, float mid, float highMid, float treble) {
    vec2 centered = (uv - 0.5) * 2.0;
    centered.x *= ubuf.u_aspect;

    float theta = atan(centered.y, centered.x);
    float d = length(centered);
    float innerRadius = ubuf.u_inner_diameter / 2.0;
    float baseRadius = visualBaseRadius(innerRadius);

    vec4 color = vec4(0.0);
    addRings(color, theta, d, iTime, bass, mid, highMid, treble);

    float adjustedTheta = theta + PI + iTime * ubuf.u_rotation_speed * 0.2;
    float normalizedAngle = mod(adjustedTheta, TWOPI) / TWOPI;
    float mirroredPos = normalizedAngle < 0.5 ? normalizedAngle * 2.0 : (1.0 - normalizedAngle) * 2.0;
    float smoothedAudio = catmullAudio(mirroredPos);
    float waveRadius = min(baseRadius + smoothedAudio * 0.5, MAX_VISUAL_RADIUS);

    if (d >= innerRadius && d <= waveRadius) {
        float fillFactor = (d - innerRadius) / max(waveRadius - innerRadius, 0.001);
        vec3 fillColor = mix(ubuf.u_primary.rgb * 0.8, ubuf.u_secondary.rgb, fillFactor);
        fillColor *= 1.0 + bass * 0.3;
        float fillAlpha = clamp(mix(0.4, 1.0, fillFactor) * ubuf.u_wave_thickness, 0.0, 1.0);
        color = max(color, vec4(fillColor, fillAlpha * max(ubuf.u_primary.a, ubuf.u_secondary.a)));
    }

    float edgeThickness = ubuf.u_wave_thickness * 0.025;
    float distToEdge = abs(d - waveRadius);
    if (distToEdge < edgeThickness) {
        float edgeFactor = 1.0 - smoothstep(0.0, edgeThickness, distToEdge);
        vec3 edgeColor = ubuf.u_secondary.rgb * (1.2 + smoothedAudio * 0.5);
        if (smoothedAudio > 0.5) {
            edgeColor += vec3(0.3, 0.4, 0.5) * (smoothedAudio - 0.5);
        }
        color = max(color, vec4(edgeColor, edgeFactor * ubuf.u_secondary.a));
    }

    return color;
}

void addBloom(inout vec4 color, vec2 uv, float iTime, float bass, float mid, float highMid, float treble) {
    if (ubuf.u_bloom_intensity <= 0.01 || color.a >= 0.01) {
        return;
    }

    vec2 centered = (uv - 0.5) * 2.0;
    centered.x *= ubuf.u_aspect;
    float d = length(centered);
    float theta = atan(centered.y, centered.x);

    float innerRadius = ubuf.u_inner_diameter / 2.0;
    float baseRadius = visualBaseRadius(innerRadius);
    float glowAmount = 0.0;
    vec3 glowColor = vec3(0.0);

    float outerRad = innerRadius + bass * 0.05;
    float ringDist = abs(d - outerRad);
    float ringGlow = exp(-ringDist * 8.0 / ubuf.u_bloom_intensity) * (1.0 + bass * 0.5);
    glowColor += ubuf.u_primary.rgb * ringGlow;
    glowAmount = max(glowAmount, ringGlow);

    float accentRad = innerRadius * 0.92;
    float accentDist = abs(d - accentRad);
    float accentGlow = exp(-accentDist * 10.0 / ubuf.u_bloom_intensity) * (0.7 + bass * 0.3);
    glowColor += mix(ubuf.u_secondary.rgb, ubuf.u_primary.rgb, 0.5) * accentGlow;
    glowAmount = max(glowAmount, accentGlow);

    if (d > innerRadius * 0.8) {
        float adjustedTheta = theta + PI + iTime * ubuf.u_rotation_speed * 0.2;
        float circlePos = mod(adjustedTheta, TWOPI) / TWOPI;
        float mirroredPos = circlePos < 0.5 ? circlePos * 2.0 : (1.0 - circlePos) * 2.0;
        float smoothedAudio = catmullAudio(mirroredPos);
        float waveRadius = min(baseRadius + smoothedAudio * 0.5, MAX_VISUAL_RADIUS);
        float distToWave = abs(d - waveRadius);
        float waveGlow = exp(-distToWave * 8.0 / ubuf.u_bloom_intensity) * smoothedAudio * 2.5;
        glowColor += mix(ubuf.u_primary.rgb, ubuf.u_secondary.rgb, smoothedAudio) * waveGlow;
        glowAmount = max(glowAmount, waveGlow);
    }

    float bloomMult = ubuf.u_bloom_intensity * (1.0 + bass * 0.5);
    color.rgb = min(glowColor * bloomMult, vec3(1.5));
    color.a = min(glowAmount * bloomMult * 0.6 * max(ubuf.u_primary.a, ubuf.u_secondary.a), 0.8);
}

void main() {
    fillBars();

    vec2 uv = qt_TexCoord0;
    float iTime = sin(ubuf.u_time * TWOPI / 3600.0) * 1800.0 + 1800.0;

    float bass = getBass();
    float mid = getMid();
    float highMid = getHighMid();
    float treble = getTreble();

    vec4 color = computePolarWave(uv, iTime, bass, mid, highMid, treble);
    addBloom(color, uv, iTime, bass, mid, highMid, treble);

    vec2 fromCenter = (uv - 0.5) * 2.0;
    float edgeProximity = max(abs(fromCenter.x), abs(fromCenter.y));
    color *= 1.0 - smoothstep(MAX_VISUAL_RADIUS, 1.0, edgeProximity);

    float finalAlpha = color.a;
    fragColor = vec4(color.rgb * finalAlpha, finalAlpha) * ubuf.qt_Opacity;
}
