import { FULLSCREEN_VS, GLSL_PALETTE, getGL, hexToRgb, loseContext, program, ramp, setPalette, type Prog, type Study } from '../core';

/**
 * Ink — a real fluid solver (advect, curl, pressure, project) running on the
 * GPU. Dragging pushes the fluid and bleeds colour into it.
 */
const HEAD = `#version 300 es
precision highp float;
in vec2 v_uv;out vec4 o;
uniform vec2 u_texel;
`;
const ADVECT = HEAD + `uniform sampler2D u_vel,u_src;uniform float u_dt,u_diss;
void main(){vec2 c=v_uv-u_dt*texture(u_vel,v_uv).xy*u_texel;o=u_diss*texture(u_src,c);}`;
const SPLAT = HEAD + `uniform sampler2D u_src;uniform vec3 u_col;uniform vec2 u_pt;uniform float u_rad,u_aspect;
void main(){vec2 p=v_uv-u_pt;p.x*=u_aspect;o=vec4(texture(u_src,v_uv).xyz+u_col*exp(-dot(p,p)/u_rad),1.);}`;
const NB = `vec2 L=v_uv-vec2(u_texel.x,0.),R=v_uv+vec2(u_texel.x,0.),T=v_uv+vec2(0.,u_texel.y),B=v_uv-vec2(0.,u_texel.y);`;
const CURL = HEAD + `uniform sampler2D u_vel;
void main(){${NB}o=vec4(.5*(texture(u_vel,R).y-texture(u_vel,L).y-texture(u_vel,T).x+texture(u_vel,B).x),0.,0.,1.);}`;
const VORT = HEAD + `uniform sampler2D u_vel,u_curl;uniform float u_dt,u_amt;
void main(){${NB}
  float l=texture(u_curl,L).x,r=texture(u_curl,R).x,t=texture(u_curl,T).x,b=texture(u_curl,B).x,c=texture(u_curl,v_uv).x;
  vec2 f=.5*vec2(abs(t)-abs(b),abs(r)-abs(l));f/=length(f)+1e-4;f*=u_amt*c;f.y*=-1.;
  vec2 v=texture(u_vel,v_uv).xy+f*u_dt;o=vec4(clamp(v,-1000.,1000.),0.,1.);}`;
const DIV = HEAD + `uniform sampler2D u_vel;
void main(){${NB}
  float l=texture(u_vel,L).x,r=texture(u_vel,R).x,t=texture(u_vel,T).y,b=texture(u_vel,B).y;vec2 c=texture(u_vel,v_uv).xy;
  if(L.x<0.)l=-c.x;if(R.x>1.)r=-c.x;if(T.y>1.)t=-c.y;if(B.y<0.)b=-c.y;
  o=vec4(.5*(r-l+t-b),0.,0.,1.);}`;
const PRES = HEAD + `uniform sampler2D u_p,u_div;
void main(){${NB}o=vec4((texture(u_p,L).x+texture(u_p,R).x+texture(u_p,T).x+texture(u_p,B).x-texture(u_div,v_uv).x)*.25,0.,0.,1.);}`;
const GRAD = HEAD + `uniform sampler2D u_p,u_vel;
void main(){${NB}o=vec4(texture(u_vel,v_uv).xy-vec2(texture(u_p,R).x-texture(u_p,L).x,texture(u_p,T).x-texture(u_p,B).x),0.,1.);}`;
const SHOW = HEAD + GLSL_PALETTE + `uniform sampler2D u_dye;uniform float u_var;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec3 d=texture(u_dye,v_uv).rgb;
  float a=max(d.r,max(d.g,d.b));
  vec3 col;
  if(u_light>.5){
    vec3 pig=d/max(a,.001);
    col=mix(u_bg,pig*u_bg+pig*.25,1.-exp(-a*1.6));
  }else{
    col=u_bg+(1.-exp(-d*1.25));
    if(u_var>1.5){float l=1.-exp(-a*2.);float e=fwidth(l*7.);col=u_bg+ramp(l)*(1.-smoothstep(e*.6,e*1.6,abs(fract(l*7.-.5)-.5)))*step(.03,l);}
  }
  col+=(h21(gl_FragCoord.xy)-.5)*.02;
  o=vec4(col,1.);
}`;

interface FBO { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number }
interface Pair { read: FBO; write: FBO }

export const fluid: Study = {
  id: 'ink',
  title: 'Ink',
  line: 'A real fluid simulation. Colour bleeds, folds and curls the way it would in water.',
  hint: 'Drag through it. Click for a bloom.',
  variants: ['Ink', 'Smoke', 'Lines'],
  maxDpr: 1.5,
  create(canvas) {
    const gl = getGL(canvas);
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    gl.getExtension('OES_texture_float_linear');
    const mk = (fs: string, n: string) => program(gl, FULLSCREEN_VS, fs, n);
    const P = {
      advect: mk(ADVECT, 'advect'), splat: mk(SPLAT, 'splat'), curl: mk(CURL, 'curl'), vort: mk(VORT, 'vort'),
      div: mk(DIV, 'div'), pres: mk(PRES, 'pres'), grad: mk(GRAD, 'grad'), show: mk(SHOW, 'show'),
    };
    if (Object.values(P).some((x) => !x)) return null;
    const pr = P as Record<keyof typeof P, Prog>;

    const fbo = (w: number, h: number, linear: boolean): FBO => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const fl = linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, fl);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, fl);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo: f, w, h };
    };
    const pair = (w: number, h: number, linear = true): Pair => ({ read: fbo(w, h, linear), write: fbo(w, h, linear) });
    const swap = (p: Pair) => { const t = p.read; p.read = p.write; p.write = t; };

    let vel: Pair, dye: Pair, pres: Pair, div: FBO, curl: FBO;
    let aspect = 0;
    const build = (a: number) => {
      aspect = a;
      const sh = 144, dh = 640;
      const sw = Math.round(sh * a), dw = Math.round(dh * a);
      vel = pair(sw, sh); dye = pair(dw, dh); pres = pair(sw, sh, false);
      div = fbo(sw, sh, false); curl = fbo(sw, sh, false);
    };
    const bind = (t: WebGLTexture, unit: number) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); return unit; };
    const blit = (target: FBO | null, w?: number, h?: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, target ? target.w : w!, target ? target.h : h!);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const splat = (x: number, y: number, dx: number, dy: number, col: number[], rad: number) => {
      const s = pr.splat;
      gl.useProgram(s.p);
      gl.uniform1f(s.u.u_aspect, aspect);
      gl.uniform2f(s.u.u_pt, x, y);
      gl.uniform1i(s.u.u_src, bind(vel.read.tex, 0));
      gl.uniform3f(s.u.u_col, dx, dy, 0);
      gl.uniform1f(s.u.u_rad, rad);
      blit(vel.write); swap(vel);
      gl.uniform1i(s.u.u_src, bind(dye.read.tex, 0));
      gl.uniform3f(s.u.u_col, col[0], col[1], col[2]);
      blit(dye.write); swap(dye);
    };

    let seen = 0;
    let palId = '';
    return {
      frame(f) {
        const a = f.w / f.h;
        if (Math.abs(a - aspect) > 0.01) build(a);
        if (palId !== f.pal.id) {
          // A palette change washes the old colours out.
          palId = f.pal.id;
          for (const t of [dye.read, dye.write]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.clear(gl.COLOR_BUFFER_BIT); }
        }
        gl.disable(gl.BLEND);
        const dt = Math.min(f.dt, 0.02);
        const smoke = f.variant === 1;
        const hue = 0.5 + 0.5 * Math.sin(f.t * 0.23);
        let c = ramp(f.pal, f.pal.light ? 0.25 + hue * 0.75 : 0.3 + hue * 0.7).map((v) => v * (f.pal.light ? 0.55 : 0.28));
        if (smoke) c = hexToRgb(f.pal.ink).map((v) => v * 0.16);
        // Three slow emitters keep colour moving even when nobody is touching it.
        for (let i = 0; i < 3; i++) {
          const ph = f.t * (0.11 + i * 0.037) + i * 2.1;
          const ex = 0.5 + 0.36 * Math.cos(ph * 1.3 + i), ey = 0.5 + 0.3 * Math.sin(ph * 1.7 + i * 0.5);
          const et = (i / 3 + f.t * 0.02) % 1;
          const ec = smoke ? c : ramp(f.pal, f.pal.light ? et : 0.3 + et * 0.7).map((v) => v * (f.pal.light ? 0.2 : 0.075));
          splat(ex, ey, -Math.sin(ph * 1.3 + i) * 110 * a, Math.cos(ph * 1.7 + i * 0.5) * 110, ec, 0.0045);
        }
        const speed = Math.hypot(f.dx, f.dy);
        if (f.hover && speed > 0.0004) {
          const k = 5200;
          splat(f.px, 1 - f.py, f.dx * k * a, -f.dy * k, c.map((v) => v * Math.min(1, 0.35 + speed * 40)), 0.0016);
        }
        if (f.clicks.length !== seen) {
          const cl = f.clicks[f.clicks.length - 1];
          if (cl && cl.age < 0.1) {
            for (let i = 0; i < 9; i++) {
              const an = (i / 9) * Math.PI * 2 + f.t;
              const cc = ramp(f.pal, i / 9).map((v) => v * (f.pal.light ? 0.6 : 0.5));
              splat(cl.x, 1 - cl.y, Math.cos(an) * 340, Math.sin(an) * 340, smoke ? c.map((v) => v * 3) : cc, 0.0012);
            }
          }
        }
        seen = f.clicks.length;

        const tx = [1 / vel.read.w, 1 / vel.read.h];
        gl.useProgram(pr.curl.p);
        gl.uniform2fv(pr.curl.u.u_texel, tx);
        gl.uniform1i(pr.curl.u.u_vel, bind(vel.read.tex, 0));
        blit(curl);
        gl.useProgram(pr.vort.p);
        gl.uniform2fv(pr.vort.u.u_texel, tx);
        gl.uniform1i(pr.vort.u.u_vel, bind(vel.read.tex, 0));
        gl.uniform1i(pr.vort.u.u_curl, bind(curl.tex, 1));
        gl.uniform1f(pr.vort.u.u_amt, smoke ? 30 : 16);
        gl.uniform1f(pr.vort.u.u_dt, dt);
        blit(vel.write); swap(vel);
        gl.useProgram(pr.div.p);
        gl.uniform2fv(pr.div.u.u_texel, tx);
        gl.uniform1i(pr.div.u.u_vel, bind(vel.read.tex, 0));
        blit(div);
        gl.useProgram(pr.pres.p);
        gl.uniform2fv(pr.pres.u.u_texel, tx);
        gl.uniform1i(pr.pres.u.u_div, bind(div.tex, 1));
        for (let i = 0; i < 18; i++) {
          gl.uniform1i(pr.pres.u.u_p, bind(pres.read.tex, 0));
          blit(pres.write); swap(pres);
        }
        gl.useProgram(pr.grad.p);
        gl.uniform2fv(pr.grad.u.u_texel, tx);
        gl.uniform1i(pr.grad.u.u_p, bind(pres.read.tex, 0));
        gl.uniform1i(pr.grad.u.u_vel, bind(vel.read.tex, 1));
        blit(vel.write); swap(vel);
        gl.useProgram(pr.advect.p);
        gl.uniform2fv(pr.advect.u.u_texel, tx);
        gl.uniform1f(pr.advect.u.u_dt, dt);
        gl.uniform1i(pr.advect.u.u_vel, bind(vel.read.tex, 0));
        gl.uniform1i(pr.advect.u.u_src, 0);
        gl.uniform1f(pr.advect.u.u_diss, Math.exp(-dt * 0.18));
        blit(vel.write); swap(vel);
        gl.uniform1i(pr.advect.u.u_vel, bind(vel.read.tex, 0));
        gl.uniform1i(pr.advect.u.u_src, bind(dye.read.tex, 1));
        gl.uniform1f(pr.advect.u.u_diss, Math.exp(-dt * (smoke ? 0.6 : 0.42)));
        blit(dye.write); swap(dye);

        gl.useProgram(pr.show.p);
        setPalette(gl, pr.show, f.pal);
        gl.uniform2f(pr.show.u.u_texel, 1 / dye.read.w, 1 / dye.read.h);
        gl.uniform1f(pr.show.u.u_var, f.variant);
        gl.uniform1i(pr.show.u.u_dye, bind(dye.read.tex, 0));
        blit(null, f.w, f.h);
      },
      destroy: () => loseContext(gl),
    };
  },
};
