import { FULLSCREEN_VS, GLSL_IMAGE, GLSL_PALETTE, getGL, loseContext, program, setPalette, type Study } from '../core';

/** Lattice — a plain grid of marks that leans away from you and swells where a wave passes. */
const FS = `#version 300 es
precision highp float;
${GLSL_PALETTE}
${GLSL_IMAGE}
uniform vec2 u_res,u_ptr;
uniform float u_time,u_var,u_dpr,u_density;
uniform vec3 u_cl[6];
in vec2 v_uv;out vec4 o;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
void main(){
  float cell=max(4.,(u_var>1.5&&u_var<2.5?13.:24.)*u_dpr/u_density);
  vec2 fc=gl_FragCoord.xy;
  /* the grid bulges away from the pointer like a lens */
  vec2 dp=fc-u_ptr;
  float pd=length(dp)/u_res.y;
  fc-=dp*.3*exp(-pd*pd*9.);
  vec2 id=floor(fc/cell);
  vec2 lc=(fract(fc/cell)-.5);
  vec2 wp=id*cell/u_res.y;
  float wave=vn(wp*2.2+vec2(u_time*.12,-u_time*.08))*.6+.4*vn(wp*5.+vec2(-u_time*.2,u_time*.15)+7.);
  wave=smoothstep(.25,.85,wave);
  /* resemble the picture: bright parts of it become big marks */
  vec2 im=imgAt((id+.5)*cell/u_res,u_res);
  float lum=u_light>.5?(1.-im.x)*im.y:im.x*im.y;
  float pic=u_hasImg*step(2.5,u_var);
  /* lift the mid-tones so faces read, and keep a faint mark wherever the subject is */
  float tone=pow(smoothstep(mix(.03,.22,u_light),.97,lum),mix(.62,1.15,u_light));
  wave=mix(wave,tone*(.88+.12*wave)+.1*im.y,pic);
  for(int i=0;i<6;i++){
    float rr=length(id*cell-u_cl[i].xy)/u_res.y;float a=u_cl[i].z;
    wave+=1.2*exp(-abs(rr-a*.6)*14.)*exp(-a*1.1);
  }
  wave+=mix(.55,.3,pic)*exp(-pd*pd*16.);
  wave=clamp(wave,0.,1.1);
  float s=.06+.34*wave;
  float d;
  if(u_var<.5||u_var>2.5)d=length(lc)-s;
  else if(u_var<1.5){
    /* plus signs */
    vec2 a=abs(lc);
    d=min(max(a.x-s*1.15,a.y-.035-.03*wave),max(a.y-s*1.15,a.x-.035-.03*wave));
  }else d=max(abs(lc.x),abs(lc.y))-s*1.05;
  float aa=1.5/cell;
  float m=1.-smoothstep(-aa,aa,d);
  vec3 c=ramp(u_light>.5?wave*.8:.1+wave*.8);
  float alpha=m*(mix(.22,.1+.3*im.y,pic)+.78*min(wave,1.));
  vec3 col=mix(u_bg,c,alpha);
  o=vec4(col,1.);
}`;

export const lattice: Study = {
  id: 'lattice',
  title: 'Lattice',
  line: 'A plain grid of marks. It swells where a wave passes and leans away from you.',
  hint: 'Move through it. Click to drop a ring.',
  variants: ['Dots', 'Plus', 'Pixels', 'Portrait'],
  create(canvas) {
    const gl = getGL(canvas);
    if (!gl) return null;
    const pr = program(gl, FULLSCREEN_VS, FS, 'lattice');
    if (!pr) return null;
    const tex = gl.createTexture();
    let imgV = -1;
    return {
      frame(f) {
        if (imgV !== f.imgV) {
          imgV = f.imgV;
          if (f.img) {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f.img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          }
        }
        const cl = new Float32Array(18).fill(99);
        f.clicks.slice(-6).forEach((c, i) => cl.set([c.x * f.w, (1 - c.y) * f.h, c.age], i * 3));
        gl.viewport(0, 0, f.w, f.h);
        gl.useProgram(pr.p);
        setPalette(gl, pr, f.pal);
        gl.uniform2f(pr.u.u_res, f.w, f.h);
        gl.uniform2f(pr.u.u_ptr, f.sx * f.w, (1 - f.sy) * f.h);
        gl.uniform1f(pr.u.u_time, f.t);
        gl.uniform1f(pr.u.u_var, f.variant);
        gl.uniform1f(pr.u.u_dpr, f.dpr);
        gl.uniform3fv(pr.u.u_cl, cl);
        gl.uniform1f(pr.u.u_density, f.density);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(pr.u.u_img, 0);
        gl.uniform1f(pr.u.u_hasImg, f.img ? 1 : 0);
        gl.uniform1f(pr.u.u_ia, f.img ? f.img.width / f.img.height : 1);
        gl.uniform1f(pr.u.u_cover, f.cover ? 1 : 0);
        gl.uniform1f(pr.u.u_iscale, f.imgScale);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy: () => loseContext(gl),
    };
  },
};
