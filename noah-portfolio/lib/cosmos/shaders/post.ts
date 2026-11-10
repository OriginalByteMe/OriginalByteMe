/**
 * The two full-screen passes that sit after the scenes.
 *
 * COMPOSITE blends scene A into scene B with one of six transitions and writes
 * "how much B" into alpha. POST reads that alpha to decide, per cell, which
 * render style to draw — so a new chapter arrives already in its own style,
 * through the same shape the transition is cutting.
 */

const HEAD = `#version 300 es
precision highp float;
out vec4 o;
const float PI=3.14159265;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
`;

export const COMPOSITE = HEAD + `
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform float u_mix;
uniform int u_trans;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_hot;
uniform vec3 u_bg;
uniform vec3 u_click;
uniform vec2 u_cur;
uniform float u_energy;
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  float asp=u_res.x/u_res.y;
  float m=clamp(u_mix,0.,1.);
  /* a click sends a shockwave through whatever is on screen */
  vec2 cd=(uv-u_click.xy)*vec2(asp,1.);
  float cr=length(cd)+1e-4;
  float wave=u_click.z*.85;
  float env=exp(-abs(cr-wave)*9.)*exp(-u_click.z*1.6);
  uv-=cd/cr/vec2(asp,1.)*sin((cr-wave)*46.)*env*.022;
  vec3 ripple=u_hot*env*.35*smoothstep(.0,.6,sin((cr-wave)*46.));
  /* and the pointer bends space a little */
  vec2 ld=(uv-u_cur)*vec2(asp,1.);
  uv-=ld/vec2(asp,1.)*.09*exp(-dot(ld,ld)*60.)*(.5+u_energy);
  if(m<=0.){o=vec4(texture(u_a,uv).rgb+ripple,0.);return;}
  if(m>=1.){o=vec4(texture(u_b,uv).rgb+ripple,1.);return;}
  vec2 cp=(uv-.5)*vec2(asp,1.);
  float r=length(cp);
  vec3 A,B;float k;vec3 glow=vec3(0.);
  if(u_trans==1){
    /* swallow: a horizon opens in the middle and the next scene is inside it */
    float rad=pow(m,1.5)*(.62*length(vec2(asp,1.))+.06);
    vec2 q=cp*(1.-.55*rad*rad/(r*r+.0005+rad*rad*.4));
    q=rot(m*1.6*exp(-r*2.))*q;
    A=texture(u_a,q/vec2(asp,1.)+.5).rgb;
    vec2 qb=cp*mix(1.7,1.,smoothstep(0.,1.,m));
    B=texture(u_b,qb/vec2(asp,1.)+.5).rgb;
    B*=mix(1.,(1.-smoothstep(rad*.55,rad,r))*.9+.1,1.-m);
    k=1.-smoothstep(rad-.004,rad+.004,r);
    glow=u_hot*exp(-abs(r-rad)*45.)*(1.-m*m)*1.2;
    A*=1.-.7*exp(-max(r-rad,0.)*9.)*(1.-m);
  }else if(u_trans==2){
    /* pixel dissolve */
    vec2 cell=floor(gl_FragCoord.xy/(u_res.y/30.));
    float h=hash21(cell)*.6+vnoise(cell*.12)*.4;
    float th=m*1.2-.1;
    k=step(h,th);
    A=texture(u_a,uv).rgb;B=texture(u_b,uv).rgb;
    glow=u_hot*.7*(1.-smoothstep(0.,.05,abs(h-th)));
  }else if(u_trans==3){
    /* layer print: the next scene is laid down bottom-up */
    float y=m*1.12-.06+.003*sin(uv.x*180.);
    k=step(uv.y,y);
    A=texture(u_a,uv).rgb;B=texture(u_b,uv).rgb;
    float below=max(y-uv.y,0.);
    B+=u_hot*.5*exp(-below*26.);
    B*=.9+.1*sin(uv.y*u_res.y*.9);
    float nx=.5+.46*sin(u_time*4.5);
    glow=u_hot*(exp(-abs(uv.y-y)*220.)*.7+exp(-length((uv-vec2(nx,y))*vec2(asp,1.))*34.)*1.5);
  }else if(u_trans==4){
    /* warp zoom */
    A=vec3(0.);
    for(int i=0;i<8;i++){
      float f=float(i)/8.;
      A+=texture(u_a,.5+(uv-.5)*(1.-m*.75*(.35+.65*f))).rgb;
    }
    A/=8.;
    B=texture(u_b,.5+(uv-.5)*(1.+(1.-m)*(1.-m)*1.4)).rgb;
    k=smoothstep(.4,.8,m);
    glow=u_hot*exp(-pow((m-.6)*5.,2.))*exp(-r*2.2)*.9;
  }else if(u_trans==5){
    /* glitch */
    float band=floor(uv.y*26.);
    float h=hash21(vec2(band,floor(u_time*13.)));
    float amp=sin(m*PI);
    float sh=(h-.5)*.3*amp*step(.45,h);
    A=vec3(texture(u_a,uv+vec2(sh*1.4,0.)).r,texture(u_a,uv+vec2(sh,0.)).g,texture(u_a,uv+vec2(sh*.6,0.)).b);
    B=vec3(texture(u_b,uv-vec2(sh*1.4,0.)).r,texture(u_b,uv-vec2(sh,0.)).g,texture(u_b,uv-vec2(sh*.6,0.)).b);
    k=step(hash21(vec2(band*1.7,3.)),m);
    glow=u_hot*.25*amp*step(.93,hash21(vec2(band,floor(u_time*20.)+7.)));
  }else{
    A=texture(u_a,uv).rgb;B=texture(u_b,uv).rgb;
    k=smoothstep(0.,1.,m);
  }
  o=vec4(mix(A,B,k)+glow+ripple,k);
}`;

export const GLYPH_RAMP = " .':-~=+*ox%#&8@";

export const POST = HEAD + `
uniform sampler2D u_tex;
uniform sampler2D u_glyph;
uniform vec2 u_res;
uniform float u_dpr;
uniform float u_time;
uniform int u_sa;
uniform int u_sb;
uniform vec2 u_mouse;
uniform vec3 u_bg;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_hot;
const float NG=${GLYPH_RAMP.length}.;
vec3 T(vec2 f){return texture(u_tex,f/u_res).rgb;}
vec3 bloom(vec2 uv){
  vec3 b=textureLod(u_tex,uv,2.5).rgb*.4+textureLod(u_tex,uv,4.).rgb*.35+textureLod(u_tex,uv,5.5).rgb*.25;
  return b*b*1.5;
}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
float mx(vec3 c){return max(c.r,max(c.g,c.b));}
float bayer(vec2 p){
  const int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
  ivec2 i=ivec2(mod(p,4.));
  return (float(m[i.x+i.y*4])+.5)/16.;
}
vec3 sRaw(vec2 f){
  vec2 uv=f/u_res;vec2 d=uv-.5;
  return vec3(texture(u_tex,uv+d*.004).r,texture(u_tex,uv).g,texture(u_tex,uv-d*.004).b);
}
vec3 sPixel(vec2 f){
  float cs=floor(5.*u_dpr);
  vec2 cell=floor(f/cs);
  vec3 c=T((cell+.5)*cs);
  float l=mx(c);
  float ql=floor(sqrt(l)*6.+bayer(cell))/6.;ql*=ql;
  return clamp(c/max(l,.001)*ql,0.,1.);
}
vec3 sAscii(vec2 f){
  vec2 cs=floor(vec2(8.,14.)*u_dpr);
  vec2 cell=floor(f/cs);vec2 lu=fract(f/cs);
  vec3 c=T((cell+.5)*cs);
  float l=lum(c);
  float gi=floor(clamp(pow(l,.7)*1.3,0.,.999)*NG);
  float g=texture(u_glyph,vec2((gi+lu.x)/NG,1.-lu.y)).r;
  vec3 ink=c/max(mx(c),.06);
  ink=mix(ink,vec3(1.),.12)*(.7+.6*l);
  return u_bg*.6+c*.1+ink*g;
}
vec3 sDots(vec2 f){
  float cs=7.*u_dpr;
  vec2 rf=rot(.785398)*f;
  vec2 ctr=(floor(rf/cs)+.5)*cs;
  vec3 c=T(rot(-.785398)*ctr);
  float l=lum(c);
  float d=length(rf-ctr)/cs;
  float rad=sqrt(clamp(l*1.4,0.,1.))*.66;
  float m=(1.-smoothstep(rad-.09,rad+.09,d))*step(.025,l);
  vec3 ink=mix(c/max(mx(c),.08),c,.3);
  return mix(u_bg*.75,ink,m);
}
vec3 sWire(vec2 f){
  float e=1.5*u_dpr;
  float tl=lum(T(f+vec2(-e,e))),tc=lum(T(f+vec2(0.,e))),tr=lum(T(f+vec2(e,e)));
  float ml=lum(T(f+vec2(-e,0.))),mr=lum(T(f+vec2(e,0.)));
  float bl=lum(T(f+vec2(-e,-e))),bc=lum(T(f+vec2(0.,-e))),br=lum(T(f+vec2(e,-e)));
  float gx=tr+2.*mr+br-tl-2.*ml-bl;
  float gy=tl+2.*tc+tr-bl-2.*bc-br;
  float edge=smoothstep(.12,.5,length(vec2(gx,gy))*1.5);
  vec3 c=T(f);
  vec3 ink=c/max(mx(c),.1);
  vec2 gp=f/(26.*u_dpr);
  float grid=max(step(fract(gp.x),.045),step(fract(gp.y),.045));
  return u_bg*.85+u_c3*.2*grid+c*.14+mix(u_c1,ink,.65)*edge*1.15;
}
vec3 sPort(vec2 f){
  vec2 cp=(f-.5*u_res)/u_res.y-u_mouse*vec2(.1,.08);
  float r=length(cp);
  float w=.012*sin(atan(cp.y,cp.x)*7.+u_time*.8);
  float r1=.27+w,r2=.4+w;
  vec3 c=r<r1?sRaw(f):(r<r2?sPixel(f):sAscii(f));
  c+=u_hot*.8*(1.-smoothstep(.0,.004,abs(r-r1)));
  c+=u_c1*.7*(1.-smoothstep(.0,.004,abs(r-r2)));
  return c;
}
vec3 styl(int s,vec2 f){
  if(s==1)return sPixel(f);
  if(s==2)return sAscii(f);
  if(s==3)return sDots(f);
  if(s==4)return sWire(f);
  if(s==5)return sPort(f);
  return sRaw(f);
}
void main(){
  vec2 f=gl_FragCoord.xy;
  vec2 uv=f/u_res;
  int s=u_sa;
  if(u_sa!=u_sb){
    float a=texture(u_tex,uv).a;
    /* soft transitions open the new style as an iris with a ragged edge */
    float ch=hash21(floor(f/(18.*u_dpr)));
    float th=clamp(length((uv-.5)*vec2(u_res.x/u_res.y,1.))*1.05,0.,1.)*.8+ch*.2;
    if(a>th*.96+.02)s=u_sb;
  }
  vec3 c=styl(s,f);
  c+=bloom(uv)*(s==0?.85:(s==5?.5:.3));
  float v=1.-smoothstep(.4,1.2,length((uv-.5)*vec2(1.15,1.)));
  c*=mix(.5,1.,v);
  c+=(hash21(f+fract(u_time)*113.)-.5)*.03;
  o=vec4(c,1.);
}`;
