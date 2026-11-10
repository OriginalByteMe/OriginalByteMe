import { GLSL_PALETTE, getGL, hexToRgb, loseContext, program, setPalette, type Study } from '../core';

/**
 * Vase mode — one unbroken line, spiralling upward, the way a printer lays a
 * vase in a single pass. The profile breathes; the pointer twists it.
 */
const N = 22000;
const VS = `#version 300 es
precision highp float;
uniform float u_time,u_aspect,u_yaw,u_twist,u_prog,u_var,u_off;
out float v_h;out float v_a;
const float TAU=6.2831853;
void main(){
  float t=float(gl_VertexID)/${N}.;
  float turns=u_var>1.5?46.:96.;
  float a=t*turns*TAU;
  float h=t;
  float rad;
  if(u_var<.5)rad=.3+.17*sin(h*5.2+.4+.3*sin(u_time*.21))+.05*sin(h*13.-u_time*.5);
  else if(u_var<1.5)rad=.2+.3*pow(sin(h*3.14159),1.6)+.035*sin(a*5.+h*20.*u_twist);
  else rad=.34+.1*sin(h*9.+u_time*.4)+.05*sin(a*3.+u_time*.3);
  rad*=1.+.05*sin(a*7.+h*16.*u_twist+u_time*.25)*step(u_var,.5);
  a+=h*u_twist*5.;
  vec3 p=vec3(cos(a)*rad,(h-.5)*1.7,sin(a)*rad);
  float cy=cos(u_yaw),sy=sin(u_yaw);
  p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);
  float cp=cos(.32),sp=sin(.32);
  p=vec3(p.x,cp*p.y-sp*p.z,sp*p.y+cp*p.z);
  float z=3.2+p.z;
  vec2 ndc=p.xy*1.95/z;
  ndc.x/=u_aspect;
  ndc*=min(1.,u_aspect*1.3);
  ndc.x+=u_off;
  ndc.y+=.14;
  gl_Position=vec4(ndc,0.,1.);
  float built=1.-smoothstep(u_prog-.004,u_prog,t);
  float head=exp(-max(u_prog-t,0.)*90.);
  v_h=h;
  v_a=built*(clamp(1.35-(z-2.6)*.75,.1,1.)*.34+head*1.4);
}`;
const FS = `#version 300 es
precision highp float;
${GLSL_PALETTE}
in float v_h;in float v_a;out vec4 o;
void main(){
  vec3 c=ramp(u_light>.5?v_h*.85:.2+v_h*.8);
  o=u_light>.5?vec4(c,min(v_a,1.)*.7):vec4(c*v_a,v_a);
}`;

export const vase: Study = {
  id: 'vase',
  title: 'Vase mode',
  line: 'One unbroken line spiralling upward, the way a printer lays a vase in a single pass.',
  hint: 'Move sideways to turn it, up and down to twist. Click to print it again.',
  variants: ['Vessel', 'Bulb', 'Coil'],
  create(canvas) {
    const gl = getGL(canvas, { antialias: true });
    if (!gl) return null;
    const pr = program(gl, VS, FS, 'vase');
    if (!pr) return null;
    let prog = 0;
    let seen = 0;
    return {
      frame(f) {
        if (f.clicks.length !== seen && f.clicks.some((c) => c.age < 0.1)) prog = 0;
        seen = f.clicks.length;
        // Only print while the piece is actually on screen.
        if (f.scroll > 0.22) prog = Math.min(1.02, prog + f.dt * 0.16);
        const bg = hexToRgb(f.pal.bg);
        gl.viewport(0, 0, f.w, f.h);
        gl.clearColor(bg[0], bg[1], bg[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        if (f.pal.light) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(pr.p);
        setPalette(gl, pr, f.pal);
        gl.uniform1f(pr.u.u_time, f.t);
        gl.uniform1f(pr.u.u_aspect, f.w / f.h);
        gl.uniform1f(pr.u.u_yaw, f.t * 0.12 + (f.sx - 0.5) * 3);
        gl.uniform1f(pr.u.u_twist, (f.sy - 0.5) * 2.4);
        gl.uniform1f(pr.u.u_prog, prog);
        gl.uniform1f(pr.u.u_var, f.variant);
        // GL lines are one device pixel wide, so draw the strand a few times side by side.
        const passes = Math.max(1, Math.round(f.dpr * 1.5));
        for (let i = 0; i < passes; i++) {
          gl.uniform1f(pr.u.u_off, ((i - (passes - 1) / 2) * 1.6) / f.w);
          gl.drawArrays(gl.LINE_STRIP, 0, N);
        }
      },
      destroy: () => loseContext(gl),
    };
  },
};
