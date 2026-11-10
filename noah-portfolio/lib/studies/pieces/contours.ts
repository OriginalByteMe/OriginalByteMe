import { FULLSCREEN_VS, GLSL_PALETTE, getGL, loseContext, program, setPalette, type Study } from '../core';

/** Contours — a slow terrain drawn only in isolines. The pointer is a hill. */
const FS = `#version 300 es
precision highp float;
${GLSL_PALETTE}
uniform vec2 u_res,u_ptr;
uniform float u_time,u_var;
uniform vec3 u_cl[6];
in vec2 v_uv;out vec4 o;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float field(vec2 p){
  float t=u_time*.035;
  float h=vn(p*.9+vec2(t,-t*.6))*.62+vn(p*1.9+vec2(-t*1.3,t)+4.)*.27+vn(p*3.7+9.)*.08;
  vec2 d=p-u_ptr;
  h+=.3*exp(-dot(d,d)*2.6);
  for(int i=0;i<6;i++){
    vec2 c=p-u_cl[i].xy;float a=u_cl[i].z;
    float rr=length(c);
    h+=.09*sin((rr-a*.55)*16.)*exp(-abs(rr-a*.55)*5.)*exp(-a*.9);
  }
  return h;
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/min(u_res.x,u_res.y)*2.4;
  float h=field(p);
  float L=u_var>.5&&u_var<1.5?30.:16.;
  float v=h*L;
  float w=fwidth(v)*1.1;
  float f=abs(fract(v-.5)-.5);
  float line=1.-smoothstep(w*.25,w*.95,f);
  float major=1.-smoothstep(w*.7,w*1.7,abs(fract(v/5.-.5)-.5)*5.);
  vec3 lc=ramp(u_light>.5?h*.9:.15+h*.95);
  vec3 col=u_bg;
  if(u_var>1.5){
    /* bands: fill every other level */
    float band=mod(floor(v),2.);
    col=mix(col,lc,band*(u_light>.5?.5:.32));
  }else{
    col=mix(col,lc,(u_light>.5?.1:.07)*smoothstep(.35,1.,h));
  }
  col=mix(col,lc,line*(u_light>.5?.8:.75));
  col=mix(col,u_light>.5?u_ink:ramp(1.),major*.55);
  col+=(h21(gl_FragCoord.xy)-.5)*.02;
  o=vec4(col,1.);
}`;

export const contours: Study = {
  id: 'contours',
  title: 'Contours',
  line: 'A terrain that never settles, drawn only in the lines of equal height.',
  hint: 'Your pointer is a hill. Click for a ripple.',
  variants: ['Survey', 'Fine', 'Bands'],
  create(canvas) {
    const gl = getGL(canvas);
    if (!gl) return null;
    const pr = program(gl, FULLSCREEN_VS, FS, 'contours');
    if (!pr) return null;
    return {
      frame(f) {
        const m = Math.min(f.w, f.h);
        const toP = (x: number, y: number) => [((x - 0.5) * f.w) / m * 2.4, (-(y - 0.5) * f.h) / m * 2.4];
        const cl = new Float32Array(18).fill(99);
        f.clicks.slice(-6).forEach((c, i) => {
          const [x, y] = toP(c.x, c.y);
          cl.set([x, y, c.age], i * 3);
        });
        gl.viewport(0, 0, f.w, f.h);
        gl.useProgram(pr.p);
        setPalette(gl, pr, f.pal);
        gl.uniform2f(pr.u.u_res, f.w, f.h);
        const [px, py] = toP(f.sx, f.sy);
        gl.uniform2f(pr.u.u_ptr, px, py);
        gl.uniform1f(pr.u.u_time, f.t);
        gl.uniform1f(pr.u.u_var, f.variant);
        gl.uniform3fv(pr.u.u_cl, cl);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy: () => loseContext(gl),
    };
  },
};
