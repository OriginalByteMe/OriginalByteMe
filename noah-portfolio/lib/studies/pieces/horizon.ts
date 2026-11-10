import { FULLSCREEN_VS, GLSL_PALETTE, getGL, loseContext, program, setPalette, type Study } from '../core';

/** Horizon — a black hole reduced to its essentials: nothing, and the light bent around it. */
const FS = `#version 300 es
precision highp float;
${GLSL_PALETTE}
uniform vec2 u_res,u_c;
uniform float u_time,u_var,u_pulse;
in vec2 v_uv;out vec4 o;
const float PI=3.14159265;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float stars(vec2 p,float sc){
  vec2 g=p*sc;vec2 id=floor(g);vec2 f=fract(g)-.5;
  float h=h21(id);
  if(h<.86)return 0.;
  vec2 off=vec2(h21(id+3.1),h21(id+7.7))-.5;
  float d=length(f-off*.7);
  return (h-.86)*7.*(1.-smoothstep(.0,.05,d))*(.6+.4*sin(u_time*(1.+h*2.)+h*50.));
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/min(u_res.x,u_res.y)*2.;
  vec2 q=p-u_c;
  float r=length(q)+1e-4;
  float R=.34*(1.+.05*u_pulse);
  /* gravitational lens */
  vec2 bq=u_c+q*(1.-1.25*R*R/(r*r+.012));
  float st=stars(bq,26.)+.7*stars(bq+5.,52.);
  float glowT=exp(-r*1.4);
  vec3 col=u_light>.5?u_bg:u_bg+ramp(.0)*.16*glowT;
  float ink=0.;
  ink+=st*.9;
  float ang=atan(q.y,q.x);
  /* the photon ring: one clean line of light */
  float ring=exp(-abs(r-R*1.02)*150.);
  float halo=exp(-max(r-R,0.)*mix(7.,3.6,u_pulse))*(.55+.3*sin(ang*1.+u_time*.2));
  float tcol=clamp((r-R)/(R*1.6),0.,1.);
  float disk=0.;
  if(u_var>.5&&u_var<1.5){
    /* a thin tilted disk, and its far side lensed over the top */
    vec2 d=vec2(q.x,q.y/.11);
    float rd=length(d);
    float band=smoothstep(1.3*R,1.5*R,rd)*(1.-smoothstep(2.2*R,3.6*R,rd));
    float fine=.72+.28*sin(rd/R*42.+vn(vec2(rd*30.,2.))*2.);
    float beam=1.+.55*cos(atan(d.y,d.x)-PI);
    disk=band*fine*beam*(q.y<0.||r>R*1.02?1.:0.);
    float arc=smoothstep(1.05*R,1.16*R,r)*(1.-smoothstep(1.2*R,1.62*R,r));
    disk+=arc*(.75+.25*sin(r/R*60.))*(1.+.5*cos(ang-PI))*(.35+.65*abs(q.y)/r)*.8;
    tcol=clamp((rd/R-1.3)/2.2,0.,1.);
    halo*=.35;
  }
  float hole=smoothstep(R*.985,R*1.005,r);
  if(u_var>1.5){
    /* crown: the horizon grows a fringe of fine coils */
    float n=vn(vec2(ang*7.,u_time*.12))*.5+vn(vec2(ang*19.+4.,u_time*.2))*.25;
    float edge=R*(1.03+.2*n+.05*sin(ang*11.+u_time*.3));
    hole=smoothstep(edge-.012,edge+.012,r);
    vec2 g=q*38.+2.*vec2(vn(q*9.),vn(q*9.+3.));
    vec2 gf=fract(g)-.5;
    float hh=h21(floor(g));
    float coil=smoothstep(.2,.9,sin(atan(gf.y,gf.x)+length(gf)*16.-hh*6.28+u_time*.3))*(1.-smoothstep(.28,.5,length(gf)));
    float rim=smoothstep(R*.62,edge,r)*(1.-hole);
    disk+=coil*rim*.9;
    tcol=.35+.5*rim;
    ring=exp(-abs(r-edge-.03)*70.)*.6;
  }
  vec3 light=ramp(1.-tcol*.9);
  if(u_light>.5){
    /* on paper the light becomes ink */
    float a=clamp(ring*.9+halo*.5*hole+disk*.9+st*.7*hole,0.,1.);
    col=mix(col,ramp(tcol*.8),a);
    col=mix(u_ink,col,max(hole,clamp(disk,0.,1.)*step(1.5,u_var)));
  }else{
    col+=ink*hole*ramp(.95);
    col+=light*(halo*.75*hole+disk*1.25);
    col+=ramp(1.)*ring*1.3;
    col*=mix(1.,max(hole,clamp(disk*1.4,0.,1.)),1.);
    col=1.-exp(-col*1.35);
  }
  col+=(h21(gl_FragCoord.xy+fract(u_time)*61.)-.5)*.022;
  o=vec4(col,1.);
}`;

export const horizon: Study = {
  id: 'horizon',
  title: 'Horizon',
  line: 'A black hole pared back to nothing, and the light that bends around it.',
  hint: 'It follows you. Click to feed it.',
  variants: ['Halo', 'Disk', 'Crown'],
  create(canvas) {
    const gl = getGL(canvas);
    if (!gl) return null;
    const pr = program(gl, FULLSCREEN_VS, FS, 'horizon');
    if (!pr) return null;
    return {
      frame(f) {
        const m = Math.min(f.w, f.h);
        const cx = ((f.sx - 0.5) * f.w) / m * 2 * 0.55;
        const cy = (-(f.sy - 0.5) * f.h) / m * 2 * 0.55;
        const pulse = f.clicks.reduce((s, c) => s + Math.exp(-c.age * 1.6) * (1 - Math.exp(-c.age * 12)), 0);
        gl.viewport(0, 0, f.w, f.h);
        gl.useProgram(pr.p);
        setPalette(gl, pr, f.pal);
        gl.uniform2f(pr.u.u_res, f.w, f.h);
        gl.uniform2f(pr.u.u_c, cx, cy);
        gl.uniform1f(pr.u.u_time, f.t);
        gl.uniform1f(pr.u.u_var, f.variant);
        gl.uniform1f(pr.u.u_pulse, Math.min(1.5, pulse));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy: () => loseContext(gl),
    };
  },
};
