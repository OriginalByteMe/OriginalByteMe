import { GLSL_PALETTE, getGL, hexToRgb, loseContext, program, setPalette, type Study } from '../core';

/**
 * Forms — one cloud of points that keeps rearranging itself: dust, a galaxy,
 * an accretion disk bent around nothing, a printed vase, a field of data.
 */
const COUNT = 140000;
const SHAPES = 5;

const VS = `#version 300 es
precision highp float;
uniform float u_time,u_morph,u_dpr,u_aspect,u_yaw,u_pitch,u_light;
uniform vec2 u_ptr;
out float v_a;out float v_c;
const float TAU=6.2831853;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return (w>>22u)^w;}
float hu(uint n){return float(pcg(n))/4294967295.;}
float h1(float n){return hu(uint(n));}
vec3 shape(int k,vec3 r,float i,out float c){
  if(k==0){ /* dust */
    float z=r.x*2.-1.;float a=r.y*TAU;float s=sqrt(1.-z*z);
    float rad=.25+.85*pow(r.z,.45);
    c=r.z;
    return vec3(s*cos(a),z,s*sin(a))*rad;
  }
  if(k==1){ /* galaxy */
    float arm=floor(r.x*2.999);
    float rad=pow(r.y,1.5)*1.15+.02;
    float a=arm*TAU/3.+rad*4.2+(r.z-.5)*(1.1*(1.-rad*.6)+.2)+u_time*.05;
    float y=(h1(i+900000.)-.5)*.16*exp(-rad*2.2);
    c=1.-rad*.85;
    return vec3(cos(a)*rad,y,sin(a)*rad);
  }
  if(k==2){ /* accretion disk */
    float rad=.44+pow(r.y,1.8)*.72;
    float a=r.x*TAU+u_time*.22/(rad*rad+.2);
    c=1.-(rad-.44)/.72;
    return vec3(cos(a)*rad,(r.z-.5)*.018,sin(a)*rad);
  }
  if(k==3){ /* vase, printed in layers */
    float hgt=floor(r.x*96.)/96.;
    float a=r.y*TAU+hgt*1.4;
    float rad=.3+.15*sin(hgt*5.4+.5)+.05*sin(hgt*12.+u_time*.4)+.02*sin(a*6.+hgt*9.);
    c=hgt;
    return vec3(cos(a)*rad,(hgt-.5)*1.55,sin(a)*rad);
  }
  /* field */
  float gx=(floor(r.x*190.)/190.-.5)*2.5;
  float gz=(floor(r.y*190.)/190.-.5)*2.5;
  float y=.16*sin(gx*2.6+u_time*.7)*cos(gz*2.3-u_time*.5)+.07*sin((gx+gz)*4.+u_time);
  c=.5+y*2.6;
  return vec3(gx,y-.1,gz);
}
void main(){
  float i=float(gl_VertexID);
  uint ui=uint(gl_VertexID)*3u;
  vec3 r=vec3(hu(ui),hu(ui+1u),hu(ui+2u));
  float m=mod(u_morph,${SHAPES}.);
  int k=int(floor(m));
  float f=m-float(k);
  float t=clamp(f*1.7-r.z*.7,0.,1.);
  t=t*t*t*(t*(t*6.-15.)+10.);
  float ca,cb;
  vec3 a=shape(k,r,i,ca);
  vec3 b=shape(k==${SHAPES - 1}?0:k+1,r,i,cb);
  vec3 p=mix(a,b,t);
  float tr=sin(t*3.14159);
  p+=tr*.22*vec3(sin(i*.37+u_time),cos(i*.53-u_time*.7),sin(i*.91+u_time*.4))*(.3+r.x);
  float cy=cos(u_yaw),sy=sin(u_yaw),cp=cos(u_pitch),sp=sin(u_pitch);
  p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);
  p=vec3(p.x,cp*p.y-sp*p.z,sp*p.y+cp*p.z);
  /* light from the far side of the disk is bent over and under the hole */
  float wd=(k==2?1.-t:0.)+(k==1?t:0.);
  float behind=smoothstep(.02,.3,p.z)*wd;
  float rs=.4+.22*(length(p.xz)-.44);
  float side=r.z>.5?1.:-1.;
  vec2 bent=vec2(p.x,side*sqrt(max(rs*rs-p.x*p.x,0.)));
  p.xy=mix(p.xy,bent,behind*step(abs(p.x),rs));
  float z=3.1+p.z;
  vec2 ndc=p.xy*2.05/z;
  ndc.x/=max(u_aspect,.001);
  ndc*=min(1.,u_aspect*1.15);
  vec2 d=(ndc-u_ptr)*vec2(u_aspect,1.);
  ndc+=normalize(d+1e-5)/vec2(u_aspect,1.)*.07*exp(-dot(d,d)*26.);
  gl_Position=vec4(ndc,0.,1.);
  float big=pow(hu(ui+7u),14.);
  gl_PointSize=(1.25+big*3.4)*u_dpr*3.1/z;
  v_c=mix(ca,cb,t);
  v_a=(.42+.58*big)*clamp(1.5-z*.33,.25,1.)*mix(1.,.55,u_light);
}`;

const FS = `#version 300 es
precision highp float;
${GLSL_PALETTE}
in float v_a;in float v_c;
out vec4 o;
void main(){
  vec2 q=gl_PointCoord-.5;
  float a=(1.-smoothstep(.1,.5,length(q)))*v_a;
  vec3 c=ramp(u_light>.5?1.-v_c*.9:.12+v_c*.88);
  o=u_light>.5?vec4(c,a):vec4(c*a,a);
}`;

export const forms: Study = {
  id: 'forms',
  title: 'Forms',
  line: 'One cloud of 140,000 points, rearranging itself: dust, galaxy, accretion disk, printed vase, data.',
  hint: 'Move to turn it. Click to change form.',
  variants: ['Cycle', 'Dust', 'Galaxy', 'Disk', 'Vase', 'Field'],
  create(canvas) {
    const gl = getGL(canvas);
    if (!gl) return null;
    const pr = program(gl, VS, FS, 'forms');
    if (!pr) return null;
    let morph = 0;
    let target = 0;
    let seen = 0;
    let hold = 0;
    return {
      frame(f) {
        if (f.variant > 0) {
          target = f.variant - 1;
        } else {
          const fresh = f.clicks.filter((c) => c.age < 0.05).length;
          if (fresh && f.clicks.length !== seen) {
            target = Math.round(target) + 1;
            hold = 0;
          }
          hold += f.dt;
          if (hold > 7) {
            target = Math.round(target) + 1;
            hold = 0;
          }
        }
        seen = f.clicks.length;
        // Always travel forward around the loop, never back through a shape.
        let diff = target - morph;
        if (f.variant > 0) {
          diff = ((((target - morph) % SHAPES) + SHAPES) % SHAPES);
          if (diff > SHAPES - 0.001) diff = 0;
        }
        morph += Math.min(diff, f.dt * 0.38);
        const pal = f.pal;
        gl.viewport(0, 0, f.w, f.h);
        const bg = hexToRgb(pal.bg);
        gl.clearColor(bg[0], bg[1], bg[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        if (pal.light) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(pr.p);
        setPalette(gl, pr, pal);
        gl.uniform1f(pr.u.u_time, f.t);
        gl.uniform1f(pr.u.u_morph, morph);
        gl.uniform1f(pr.u.u_dpr, f.dpr);
        gl.uniform1f(pr.u.u_aspect, f.w / f.h);
        gl.uniform1f(pr.u.u_yaw, f.t * 0.07 + (f.sx - 0.5) * 2.2);
        gl.uniform1f(pr.u.u_pitch, 0.3 + (f.sy - 0.5) * 0.9);
        gl.uniform2f(pr.u.u_ptr, f.hover ? f.sx * 2 - 1 : 9, f.hover ? 1 - f.sy * 2 : 9);
        gl.drawArrays(gl.POINTS, 0, COUNT);
      },
      destroy: () => loseContext(gl),
    };
  },
};
