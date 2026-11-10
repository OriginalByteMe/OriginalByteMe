/**
 * Scene fragment shaders. Each scene defines `vec3 scene(vec2 p)` where `p` is
 * centred with y in [-1, 1]. Scenes only ever paint with the five palette
 * uniforms, which is what lets any scene sit next to any other.
 *
 * u_prog is the scroll progress through the chapter (0..1); u_var picks a
 * variant. Interaction: u_mouse is the smoothed pointer in [-1, 1], u_ptr the
 * same pointer in scene space, u_click = (x, y, seconds since the last click),
 * u_energy how fast the pointer is moving and u_spin its running total.
 */
import type { SceneId } from '../config';

export const VERT = `#version 300 es
void main(){
  vec2 v=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(v*2.-1.,0.,1.);
}`;

export const COMMON = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_prog;
uniform float u_var;
uniform vec2 u_mouse;
uniform vec2 u_ptr;
uniform vec3 u_click;
uniform float u_energy;
uniform float u_spin;
uniform vec3 u_bg;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_hot;
out vec4 o;
const float PI=3.14159265;
const float TAU=6.2831853;
float hash11(float n){return fract(sin(n*12.9898)*43758.5453);}
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hash22(vec2 p){float n=hash21(p);return vec2(n,hash21(p+n*17.13+3.1));}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.1,3.7);a*=.5;}return s;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float sdBox2(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float starLayer(vec2 p,float sc,float seed){
  vec2 g=p*sc;vec2 id=floor(g);vec2 f=fract(g)-.5;
  float h=hash21(id+seed);
  if(h<.72)return 0.;
  vec2 off=(hash22(id+seed*1.7)-.5)*.6;
  float d=length(f-off);
  float tw=.65+.35*sin(u_time*(1.+h*3.)+h*40.);
  float s=(h-.72)*3.5;
  return tw*s*(1.-smoothstep(0.,.07+.07*s,d));
}
vec3 starfield(vec2 p){
  float s=starLayer(p,14.,1.)+.8*starLayer(p+3.1,26.,2.)+.6*starLayer(p-7.3,48.,3.);
  return s*mix(vec3(1.),u_c1,.3);
}
vec3 nebula(vec2 p){
  float n=fbm(p*1.25+vec2(u_time*.015,-u_time*.01));
  float n2=fbm(p*2.2+vec2(5.2,1.3)+n);
  return u_c3*.34*smoothstep(.45,.95,n)+u_c2*.16*pow(n2,3.)+u_c1*.1*pow(n,4.);
}
/* Bumpy afro outline: negative inside. */
float afroSD(vec2 q,float R,float seed){
  float a=atan(q.y,q.x);
  float b=.1*pow(abs(sin(a*4.5+.6+seed)),.6)+.03*sin(a*14.+1.7+seed*3.)+.04*(vnoise(vec2(a*3.+seed*9.,u_time*.2))-.5)-.05;
  return length(q)-R*(1.+b);
}
/* Little spiral curls for hair texture. */
float curlTex(vec2 q,float sc){
  vec2 g=q*sc;g+=.4*vec2(vnoise(g*.6),vnoise(g*.6+9.3));
  vec2 id=floor(g);vec2 f=fract(g)-.5;
  float h=hash21(id);
  float d=length(f);
  float sp=sin(atan(f.y,f.x)+d*17.-h*TAU);
  return smoothstep(.1,.9,sp)*(1.-smoothstep(.28,.5,d));
}
/* Afro pick: handle below, tines up. Unit-ish size. */
float pickSD(vec2 p){
  float handle=sdBox2(p-vec2(0.,-.45),vec2(.3,.26))-.08;
  handle=max(handle,-(length(p-vec2(0.,-.45))-.12));
  vec2 t=p-vec2(0.,.35);
  t.x-=.16*clamp(round(t.x/.16),-2.,2.);
  float tines=sdBox2(t,vec2(.035,.5));
  return min(handle,tines);
}
/* A small face. hq is relative to the head centre, s is the head radius. */
vec3 face(vec3 col,vec2 hq,float s,float lookAmt){
  float hd=length(hq*vec2(1.,.93))-s;
  float hm=1.-smoothstep(-.012*s,.012*s,hd);
  vec3 skin=mix(vec3(.55,.33,.2),u_c1,.08);
  skin*=1.-.3*smoothstep(-.45*s,0.,hd);
  skin+=u_hot*.12*smoothstep(-.3*s,0.,hd)*step(0.,hq.x);
  col=mix(col,skin,hm);
  float bl=fract(u_time*.21);
  float blink=smoothstep(.93,.955,bl)*(1.-smoothstep(.965,.99,bl));
  vec2 look=(u_mouse*.7+.3*vec2(sin(u_time*.7),.5*cos(u_time*.53)))*.07*s*lookAmt;
  for(int i=0;i<2;i++){
    float sx=i==0?-1.:1.;
    vec2 e=hq-vec2(sx*.4*s,.06*s);
    vec2 es=vec2(e.x,e.y/(1.-.9*blink));
    float ew=1.-smoothstep(.19*s,.215*s,length(es));
    col=mix(col,vec3(.98,.96,.92),ew*hm);
    float pu=1.-smoothstep(.1*s,.125*s,length(es-look));
    col=mix(col,vec3(.07,.04,.05),pu*ew*hm);
    float hl=1.-smoothstep(.03*s,.045*s,length(es-look-vec2(.04,.05)*s));
    col=mix(col,vec3(1.),hl*ew*hm);
    float ch=1.-smoothstep(.0,.2*s,length(hq-vec2(sx*.56*s,-.26*s)));
    col=mix(col,mix(skin,u_c2,.5),ch*.45*hm);
  }
  vec2 m=hq-vec2(0.,-.3*s);
  float md=abs(length(m)-.27*s)-.035*s;
  float mm=(1.-smoothstep(0.,.02*s,md))*step(m.y,-.1*s);
  col=mix(col,vec3(.12,.05,.06),mm*hm);
  return col;
}
`;

const MAIN = `
void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/(.5*u_res.y);
  p/=min(1.,(u_res.x/u_res.y)/.9);
  vec3 c=scene(p);
  c=1.-exp(-max(c,0.)*1.3);
  o=vec4(c,1.);
}`;

const WARP = `
vec3 scene(vec2 p){
  vec3 col=u_bg+nebula(p);
  p-=u_ptr*.3;
  float r=length(p)+1e-4;
  float a=atan(p.y,p.x);
  col+=starfield(p*.8+u_mouse*.03)*.7*(1.-.6*u_prog);
  for(int i=0;i<4;i++){
    float fi=float(i);
    float sc=34.+fi*24.;
    float ang=a/TAU*sc+fi*.37;
    float id=floor(ang);
    float h=hash11(id*1.31+fi*71.7);
    float z=fract(h*17.+u_time*(.05+.09*h)+(u_prog+u_spin*.25)*(.9+h));
    float rr=z*z*2.4+.03;
    float len=rr*mix(.05,.6,clamp(u_prog+u_energy*.5,0.,1.))+.008;
    float arc=abs(fract(ang)-.5)/sc*TAU*r;
    float w=.004+.005*z;
    float line=(1.-smoothstep(w*.4,w,arc))*smoothstep(rr-len,rr-len*.15,r)*(1.-smoothstep(rr,rr+.012,r));
    vec3 sc_=mix(u_c1,u_c2,step(.5,fract(h*7.)));
    col+=mix(sc_,u_hot,z*.6)*line*z*(1.4+1.2*u_prog);
  }
  if(u_var>.5){
    float t=u_time*.35+u_prog*2.;
    float lr=log(r)*1.6-t;
    float ring=fract(lr);
    float seg=step(.35,fract(a/TAU*10.+floor(lr)*.31));
    col+=u_c1*.5*smoothstep(.86,.98,ring)*seg*smoothstep(.05,.5,r);
  }
  col+=mix(u_c1,u_hot,.6)*.5*exp(-r*5.)*(1.+1.5*u_prog);
  return col;
}`;

const AFRO = `
vec4 diskCol(vec2 d,float R){
  float rd=length(d);float ang=atan(d.y,d.x);
  float band=smoothstep(1.22*R,1.5*R,rd)*(1.-smoothstep(2.5*R,3.8*R,rd));
  float an=ang-(u_time+u_spin*3.)*(1.1*R/rd);
  float tex=fbm(vec2(cos(an),sin(an))*1.8+vec2(rd/R*5.,rd/R*2.3));
  float rings=.6+.4*sin(rd/R*30.+tex*7.);
  float beam=1.+.6*cos(ang-PI);
  float t=clamp((rd/R-1.22)/2.4,0.,1.);
  vec3 c=mix(u_hot,u_c1,smoothstep(0.,.3,t));
  c=mix(c,u_c2,smoothstep(.4,1.,t));
  float I=band*(.3+1.3*tex)*rings*beam*(1.7-t)*(1.+.7*u_energy);
  return vec4(c*I,clamp(I*1.3,0.,1.));
}
vec3 scene(vec2 p){
  vec2 c=vec2(0.,.2)+u_mouse*.025;
  float boing=exp(-u_click.z*3.)*sin(u_click.z*17.);
  float R=.4*(1.+.012*sin(u_time*1.3)+.07*boing);
  R*=mix(.8,1.,smoothstep(0.,.35,u_prog+.25));
  vec2 q=rot(-.16)*(p-c);
  float r=length(q)+1e-4;
  vec2 bq=q*(1.-1.1*R*R/(r*r+.02));
  vec3 col=u_bg+nebula(bq*.9+2.)+starfield(bq+u_mouse*.02);
  /* lensed far side of the disk, wrapped over and under the horizon */
  float qa=atan(q.y,q.x);
  float arcBand=smoothstep(1.12*R,1.26*R,r)*(1.-smoothstep(1.32*R,1.9*R,r));
  float an=qa-u_time*.55;
  float atex=fbm(vec2(cos(an),sin(an))*2.2+r/R*6.);
  float astr=.55+.45*sin(r/R*46.+atex*9.);
  float ab=arcBand*(.12+1.25*atex*atex*2.)*astr*(1.+.6*cos(qa-PI))*(.45+.55*abs(q.y)/r);
  col+=mix(mix(u_hot,u_c1,.35),mix(u_c1,u_c2,.5),smoothstep(1.05*R,1.7*R,r))*ab*.95;
  col+=u_hot*.7*exp(-abs(r-1.2*R)*110.);
  /* back half of the flat disk */
  vec2 dq=vec2(q.x,q.y/.13);
  if(q.y>0.){vec4 k=diskCol(dq,R);col+=k.rgb;}
  /* the pick satellite */
  float ot=u_time*.45;
  vec2 pp=vec2(cos(ot)*2.5*R,sin(ot)*.62*R-.05*R);
  float ps=.27*R*(1.-.25*sin(ot));
  float pk=pickSD(rot(ot*1.7)*(q-pp)/ps)*ps;
  float pm=1.-smoothstep(-.002,.004,pk);
  vec3 pcol=mix(u_c2,u_hot,.35)+u_c2*.4;
  bool pFront=sin(ot)<0.;
  if(!pFront)col=mix(col,pcol*.8,pm);
  /* the afro */
  float squash=1.+.03*sin(u_time*1.3+1.)-.14*boing;
  vec2 aq=q*vec2(1.,1./squash);
  float sd;
  if(u_var>.5&&u_var<1.5){
    sd=afroSD(aq,R*.8,0.);
    sd=min(sd,afroSD(aq-vec2(-.78,.62)*R,R*.5,1.));
    sd=min(sd,afroSD(aq-vec2(.78,.62)*R,R*.5,2.));
  }else{
    sd=afroSD(aq,R,0.);
  }
  float am=1.-smoothstep(-.012,.006,sd);
  float rim=smoothstep(-.4*R,0.,sd);
  float cu=curlTex(aq,22.);
  vec3 hair=u_bg*.2;
  float side=.55+.45*dot(q/r,normalize(vec2(-.8,.45)));
  hair+=mix(u_c1,u_hot,.45)*(.1+.75*cu)*rim*side;
  hair+=mix(u_c3,u_c1,.3)*.4*cu*(1.-rim);
  col=mix(col,hair,am);
  col+=mix(u_c1,u_hot,.5)*.22*exp(-abs(sd)*38.)*(1.-am*.6);
  /* a face under the fro */
  if(u_var<1.5){
    col=face(col,q-vec2(0.,-.64*R),.5*R,1.);
  }
  /* front half of the disk: the headband */
  if(q.y<=0.){vec4 k=diskCol(dq,R);col=col*(1.-k.a*.92)+k.rgb;}
  if(pFront){col=mix(col,pcol,pm);col+=u_c2*.25*exp(-max(pk,0.)*60.);}
  return col;
}`;

const NEURAL = `
const int NL=5;
const int NN=5;
vec3 nodeP(int l,int n){
  float fl=float(l),fn=float(n);
  float h=hash21(vec2(fl*3.1+1.3,fn*7.3+2.1));
  vec3 q=vec3((fl-2.)*.62,(fn-2.)*.36*(1.-.14*abs(fl-2.)),(h-.5)*.8);
  q.y+=.045*sin(u_time*.8+h*30.);
  q.x+=.03*cos(u_time*.6+h*17.);
  q.xz=rot(.4*sin(u_time*.17)+u_mouse.x*.35)*q.xz;
  q.yz=rot(.12+u_mouse.y*.15)*q.yz;
  float z=2.7+q.z;
  return vec3(q.xy*2.5/z,z);
}
vec3 scene(vec2 p){
  vec3 col=u_bg+nebula(p*.8+7.)*.7+starfield(p*.9)*.5;
  vec3 P[25];
  for(int l=0;l<NL;l++)for(int n=0;n<NN;n++)P[l*NN+n]=nodeP(l,n);
  float sharp=mix(1.2,4.5,u_prog);
  float dense=u_var>.5?1.6:1.;
  float lines=0.;vec3 pulses=vec3(0.);
  for(int l=0;l<NL-1;l++)for(int i=0;i<NN;i++)for(int j=0;j<NN;j++){
    float w=hash21(vec2(float(l*NN+i)+.5,float(j)+.7+float(l)*3.3));
    float st=pow(w,sharp/dense);
    if(st<.03)continue;
    vec2 a=P[l*NN+i].xy,b=P[(l+1)*NN+j].xy;
    vec2 pa=p-a,ba=b-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    float d=length(pa-ba*h);
    lines+=st*(1.-smoothstep(.001,.006+.004*st,d))*.7;
    lines+=st*.05*exp(-d*40.);
    float ph=fract(u_time*(.25+.5*w)+w*13.);
    float pd=length(p-mix(a,b,ph));
    pulses+=mix(u_c2,u_hot,w)*st*exp(-pd*pd*2600.)*1.4;
  }
  col+=mix(u_c3,u_c1,.75)*lines;
  col+=pulses;
  col+=u_hot*(exp(-length(p-u_ptr)*30.)+.3*exp(-length(p-u_ptr)*8.));
  for(int k=0;k<NL*NN;k++){
    float d=length(p-P[k].xy);
    float pdn=length(u_ptr-P[k].xy);
    float reach=1.-smoothstep(.15,.75,pdn);
    if(reach>0.){
      float sd_=sdSeg(p,u_ptr,P[k].xy);
      float tr=fract(u_time*1.4+float(k)*.37);
      col+=mix(u_c2,u_hot,.5)*reach*((1.-smoothstep(.001,.006,sd_))*.8+1.6*exp(-pow(length(p-mix(u_ptr,P[k].xy,tr))*45.,2.)));
    }
    float act=clamp(.5+.5*sin(u_time*(1.+hash11(float(k))*2.)+float(k))+reach,0.,1.3);
    float outB=k>=20?(.6+u_prog):0.;
    float s=3.2/P[k].z;
    col+=mix(u_c1,u_hot,act*.6+outB*.3)*((1.-smoothstep(.016*s,.024*s,d))*(.7+.5*act+outB)+.16*exp(-d*22./s)*(1.+outB));
  }
  return col;
}`;

const PRINTER = `
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdRBox(vec3 p,vec3 b,float r){return sdBox(p,b-r)-r;}
float sdCyl(vec3 p,float r,float h){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float gyr(vec3 p){return dot(sin(p),cos(p.yzx));}
float gH;vec3 gTip;
float objSD(vec3 p){
  if(u_var<.5){
    float handle=sdRBox(p-vec3(0.,.3,0.),vec3(.37,.3,.07),.05);
    handle=max(handle,-(length(p.xy-vec2(0.,.3))-.12));
    vec3 t=p-vec3(0.,.92,0.);
    t.x-=.105*clamp(round(t.x/.105),-3.,3.);
    return min(handle,sdRBox(t,vec3(.026,.36,.04),.02));
  }
  if(u_var<1.5){
    vec3 q=p-vec3(0.,.66,0.);
    float body=(length(q*vec3(1.,.42,1.))-.2)*.8;
    float a=atan(q.z,q.x);float sec=TAU/3.;
    a=mod(a+sec*.5,sec)-sec*.5;
    vec2 xz=length(q.xz)*vec2(cos(a),sin(a));
    float fin=sdBox(vec3(xz.x-.24,q.y+.36,xz.y),vec3(.13,.16,.018));
    fin=max(fin,(xz.x-.24)+(q.y+.36)*.7-.1);
    float noz=sdCyl(p-vec3(0.,.14,0.),.1,.1);
    return min(min(body,fin),noz);
  }
  float b=sdRBox(p-vec3(0.,.46,0.),vec3(.44),.04);
  return max(b,(abs(gyr(p*10.5))-.5)/10.5*.7);
}
vec2 map(vec3 p){
  vec2 r=vec2(sdRBox(p-vec3(0.,-.05,0.),vec3(1.,.05,1.),.03),1.);
  float fr=sdBox(vec3(abs(p.x)-1.15,p.y-.95,p.z),vec3(.055,1.,.055));
  fr=min(fr,sdBox(p-vec3(0.,1.95,0.),vec3(1.2,.055,.055)));
  fr=min(fr,sdBox(p-vec3(0.,gH+.5,0.),vec3(1.15,.035,.035)));
  fr=min(fr,sdBox(vec3(abs(p.x)-1.15,p.y+.06,p.z),vec3(.12,.06,.5)));
  if(fr<r.x)r=vec2(fr,2.);
  float ob=max(objSD(p),p.y-gH);
  if(ob<r.x)r=vec2(ob,3.);
  vec3 hp=p-gTip;
  float he=sdRBox(hp-vec3(0.,.4,0.),vec3(.1,.13,.1),.02);
  he=min(he,sdCyl(hp-vec3(0.,.2,0.),.045,.09));
  float tip=max(sdCyl(hp-vec3(0.,.06,0.),.05,.06),length(hp.xz)-.012-hp.y*.6);
  if(he<r.x)r=vec2(he,4.);
  if(tip<r.x)r=vec2(tip,5.);
  return r;
}
vec3 nrm(vec3 p){
  vec2 e=vec2(.0015,-.0015);
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}
vec3 scene(vec2 p){
  gH=.02+u_prog*1.3;
  float sw=u_var<.5?.36:(u_var<1.5?.22:.42);
  gTip=vec3(sin(u_time*2.6)*sw,gH,sin(u_time*1.7)*.05);
  float ca=.65+.3*sin(u_time*.13)+u_mouse.x*.5;
  vec3 ro=vec3(sin(ca)*3.7,1.75+u_mouse.y*.4,cos(ca)*3.7);
  vec3 ta=vec3(0.,.85,0.);
  vec3 ww=normalize(ta-ro),uu=normalize(cross(ww,vec3(0.,1.,0.))),vv=cross(uu,ww);
  vec3 rd=normalize(p.x*uu+p.y*vv+2.5*ww);
  vec3 col=u_bg+nebula(p*.7+11.)*.8+starfield(p)*.6;
  col+=u_c3*.25*exp(-length(p-vec2(0.,-.2))*1.2);
  float t=0.;float id=0.;float glow=0.;bool hit=false;
  for(int i=0;i<84;i++){
    vec3 q=ro+rd*t;
    vec2 m=map(q);
    glow+=exp(-length(q-gTip)*11.)*.035;
    if(m.x<.0012*t){hit=true;id=m.y;break;}
    t+=m.x*.85;
    if(t>14.)break;
  }
  if(hit){
    vec3 q=ro+rd*t;vec3 n=nrm(q);
    vec3 L=normalize(vec3(.5,.9,.45));
    float dif=clamp(dot(n,L),0.,1.);
    float ao=clamp(map(q+n*.14).x/.14,0.,1.);
    float fre=pow(1.-clamp(dot(n,-rd),0.,1.),3.);
    float tipL=exp(-length(q-gTip)*3.5);
    vec3 c;
    if(id<1.5){
      vec2 g=abs(fract(q.xz*5.)-.5);
      float gl=1.-smoothstep(.0,.035,min(g.x,g.y));
      c=u_c3*.22+u_c2*.35*gl*step(.9,n.y);
      c*=.5+.5*dif;
    }else if(id<2.5){
      c=mix(u_bg,u_c3,.55)*(.5+.8*dif)+u_c1*.5*fre;
    }else if(id<3.5){
      float lay=.82+.18*sin(q.y*TAU/.026);
      c=u_c1*(.25+.75*dif)*lay;
      float heat=exp(-(gH-q.y)*7.);
      c=mix(c,mix(u_c2,u_hot,heat),heat*.75);
      if(q.y>gH-.006&&n.y>.6){
        float shell=smoothstep(-.035,-.02,objSD(q));
        float inf=1.-smoothstep(.2,.38,abs(gyr(vec3(q.x,gH,q.z)*30.)));
        float wall=max(shell,inf);
        c=mix(u_bg*.6,mix(u_c2,u_hot,.55)*1.15,wall);
      }
      c+=u_c2*.35*fre;
    }else if(id<4.5){
      c=mix(u_c3,vec3(.5),.25)*(.4+.8*dif)+u_c1*.4*fre;
    }else{
      c=u_hot*1.6;
    }
    c*=.45+.55*ao;
    c+=u_hot*tipL*.55;
    col=mix(col,c,exp(-t*.02));
  }
  col+=mix(u_c2,u_hot,.6)*glow;
  return col;
}`;

const GEARS = `
float gearD(vec2 p,float r,float T,float phi){
  float a=atan(p.y,p.x);float l=length(p);
  float tooth=smoothstep(-.4,.4,cos(T*(a-phi)));
  float d=l-(r-.034+.068*tooth);
  d=max(d,-(l-r*.2));
  if(r>.2){
    float sec=TAU/5.;
    float sa=mod(a-phi+sec*.5,sec)-sec*.5;
    vec2 sp=l*vec2(cos(sa),sin(sa))-vec2(r*.58,0.);
    d=max(d,-(length(sp)-r*.18));
  }
  return d;
}
vec3 drawGear(vec3 col,vec2 p,vec2 c,float r,float T,float phi,float al){
  vec2 q=p-c;
  float d=gearD(q,r,T,phi);
  float l=length(q);
  col=mix(col,u_c3*.55+u_bg*.5,(1.-smoothstep(-.004,.004,d))*.85*al);
  col+=u_c1*(1.-smoothstep(.003,.009,abs(d)))*al;
  float dash=step(.5,fract(atan(q.y,q.x)/TAU*T*2.));
  col+=u_c2*.55*(1.-smoothstep(.001,.005,abs(l-r)))*dash*al;
  col+=u_c2*.4*(1.-smoothstep(.001,.004,min(abs(q.x),abs(q.y))))*(1.-smoothstep(r*.12,r*.16,l))*al;
  col+=u_hot*(1.-smoothstep(.012,.02,l))*al;
  return col;
}
float meshPhi(float th,float Ti,float phii,float Tj){return th+PI+(Ti*(th-phii)-PI)/Tj;}
vec3 scene(vec2 p){
  vec3 col=u_bg;
  vec2 g1=abs(fract(p*4.)-.5),g2=abs(fract(p*20.)-.5);
  col+=u_c3*.26*(1.-smoothstep(.0,.02,min(g1.x,g1.y)));
  col+=u_c3*.1*(1.-smoothstep(.0,.06,min(g2.x,g2.y)));
  p.y-=.08;
  float ph0=u_time*.35+u_prog*3.+u_spin*2.5;
  float pr=u_prog+.4;
  vec2 c0=vec2(-.12,.02);
  float th1=.55,th2=3.55,th3=-.7,th4=4.75;
  vec2 c1=c0+.63*vec2(cos(th1),sin(th1));
  vec2 c2=c0+.714*vec2(cos(th2),sin(th2));
  vec2 c3=c1+.378*vec2(cos(th3),sin(th3));
  vec2 c4=c2+.546*vec2(cos(th4),sin(th4));
  float ph1=meshPhi(th1,20.,ph0,10.);
  float ph2=meshPhi(th2,20.,ph0,14.);
  float ph3=meshPhi(th3,10.,ph1,8.);
  float ph4=meshPhi(th4,14.,ph2,12.);
  col=drawGear(col,p,c0,.42,20.,ph0,1.);
  col=drawGear(col,p,c1,.21,10.,ph1,smoothstep(.2,.35,pr));
  col=drawGear(col,p,c2,.294,14.,ph2,smoothstep(.35,.5,pr));
  col=drawGear(col,p,c3,.168,8.,ph3,smoothstep(.55,.7,pr));
  col=drawGear(col,p,c4,.252,12.,ph4,smoothstep(.75,.9,pr));
  /* sparks where teeth meet */
  vec2 m1=c0+.42*vec2(cos(th1),sin(th1)),m2=c0+.42*vec2(cos(th2),sin(th2));
  float fl=.5+.5*sin(u_time*23.);
  col+=u_hot*.5*fl*(exp(-length(p-m1)*38.)*smoothstep(.2,.35,pr)+exp(-length(p-m2)*38.)*smoothstep(.35,.5,pr));
  /* conveyor: things shipping */
  float cy=-.93;
  col+=u_c1*.8*(1.-smoothstep(.002,.006,abs(p.y-cy)));
  float bx=mod(p.x+u_time*.18+u_prog,.5)-.25;
  float bd=sdBox2(vec2(bx,p.y-cy-.075),vec2(.06,.06));
  col+=u_c2*(1.-smoothstep(.002,.007,abs(bd)));
  col+=u_c2*.2*(1.-smoothstep(0.,.004,bd));
  float rl=length(vec2(mod(p.x-u_time*.18-u_prog,.25)-.125,p.y-cy+.035))-.028;
  col+=u_c1*.7*(1.-smoothstep(.002,.006,abs(rl)));
  if(u_var>.5){
    vec2 k=p-c1;
    float jaw=min(sdBox2(k-vec2(-.262,.1),vec2(.012,.34)),sdBox2(k-vec2(.262,.1),vec2(.012,.34)));
    float beam=sdBox2(k-vec2(.25,.42),vec2(.62,.03));
    float cal=min(jaw,beam);
    col+=u_hot*.9*(1.-smoothstep(.002,.007,abs(cal)));
    float tick=step(.8,fract(k.x*40.))*(1.-smoothstep(.0,.004,abs(k.y-.405)-.012))*step(abs(k.x-.25),.6);
    col+=u_hot*.7*tick;
  }
  return col;
}`;

const CITY = `
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float cityH(vec2 id){float h=hash21(id);return h<.18?.06:.3+1.7*h*h;}
float mapC(vec3 p){
  vec2 id=floor(p.xz);vec2 f=fract(p.xz)-.5;
  float h=cityH(id);
  float d=sdBox(vec3(f.x,p.y-h*.5,f.y),vec3(.3,h*.5,.3));
  float bord=.5-max(abs(f.x),abs(f.y))+.19;
  return min(min(d,bord),p.y);
}
float trueC(vec3 p){
  vec2 id=floor(p.xz);vec2 f=fract(p.xz)-.5;
  float h=cityH(id);
  return min(sdBox(vec3(f.x,p.y-h*.5,f.y),vec3(.3,h*.5,.3)),p.y);
}
vec3 scene(vec2 p){
  bool top=u_var>.5;
  float tt=u_time*.55+u_prog*5.;
  vec3 ro,ta;
  if(top){ro=vec3(tt*.4,7.5-u_prog*2.,tt*.6);ta=ro+vec3(.2+u_mouse.x*.5,-1.,.45+u_mouse.y*.3);}
  else{ro=vec3(0.,1.15+.9*u_prog+.1*sin(u_time*.4),tt);ta=ro+vec3(.25*sin(u_time*.11)+u_mouse.x*.6,-.28-.35*u_prog+u_mouse.y*.25,1.);}
  vec3 ww=normalize(ta-ro),uu=normalize(cross(ww,vec3(0.,1.,0.))),vv=cross(uu,ww);
  vec3 rd=normalize(p.x*uu+p.y*vv+1.5*ww);
  vec3 sky=u_bg+starfield(p*1.1+vec2(0.,.3))*.7+nebula(p*.6+4.)*.6;
  sky+=mix(u_c3,u_c1,.3)*.7*exp(-abs(rd.y)*7.);
  float t=0.;bool hit=false;
  for(int i=0;i<110;i++){
    vec3 q=ro+rd*t;
    float d=mapC(q);
    if(d<.002*t+.0005&&trueC(q)<.004*t+.001){hit=true;break;}
    t+=d*.9;
    if(t>34.)break;
  }
  vec3 col=sky;
  if(hit){
    vec3 q=ro+rd*t;
    vec2 e=vec2(.002,0.);
    vec3 n=normalize(vec3(trueC(q+e.xyy)-trueC(q-e.xyy),trueC(q+e.yxy)-trueC(q-e.yxy),trueC(q+e.yyx)-trueC(q-e.yyx)));
    vec2 id=floor(q.xz);float hh=hash21(id+3.7);
    bool ground=q.y<.012*t+.01&&n.y>.5&&cityH(id)*.5>q.y;
    vec2 gf=abs(fract(q.xz)-.5);
    ground=ground||(q.y<.03+.01*t&&max(gf.x,gf.y)>.31);
    if(ground){t=-ro.y/rd.y;q=ro+rd*t;}
    vec3 c;
    if(ground){
      vec2 f=abs(fract(q.xz)-.5);
      float street=smoothstep(.3,.34,max(f.x,f.y));
      c=u_bg*.6+u_c3*.12*street;
      float lw=.012+.004*t;
      float lx=(1.-smoothstep(.0,lw,abs(.5-f.x)))/(1.+t*.25);
      float lz=(1.-smoothstep(.0,lw,abs(.5-f.y)))/(1.+t*.25);
      c+=u_c3*.5*(lx+lz);
      float sx=hash11(floor(q.x+.5)*3.1),sz=hash11(floor(q.z+.5)*5.3);
      float pkx=1.-smoothstep(.0,.06,abs(fract(q.z*.35-u_time*(.3+sx)+sx*9.)-.5));
      float pkz=1.-smoothstep(.0,.06,abs(fract(q.x*.35+u_time*(.3+sz)+sz*9.)-.5));
      c+=mix(u_c2,u_hot,.5)*(lx*pkx+lz*pkz)*3.;
    }else if(n.y>.5){
      vec2 f=abs(fract(q.xz)-.5);
      float edge=smoothstep(.25,.295,max(f.x,f.y));
      c=u_bg*.8+u_c3*.25+mix(u_c1,u_c2,hh)*edge*.9;
      c+=u_hot*.8*step(.9,hh)*(1.-smoothstep(.03,.05,length(fract(q.xz)-.5)))*step(.5,fract(u_time*.8+hh*7.));
    }else{
      float u=abs(n.x)>.5?q.z:q.x;
      vec2 lc=vec2(u*11.,q.y*9.);
      vec2 li=floor(lc);vec2 lf=fract(lc);
      float hl=hash21(li+id*13.1);
      float bl=hash21(li+id*13.1+floor(u_time*(.6+2.*hl)+hl*10.));
      float on=step(.52,bl)*step(.25,hl);
      float led=(1.-smoothstep(.28,.4,abs(lf.x-.5)))*(1.-smoothstep(.16,.28,abs(lf.y-.5)));
      vec3 lcol=mix(u_c2,u_c1,step(.5,fract(hl*9.)));
      lcol=mix(lcol,u_hot,step(.93,hl));
      c=u_bg*.9+u_c3*.18*(.5+.5*abs(n.x));
      c+=lcol*led*on*1.5;
      c+=u_c1*.1*step(.92,fract(q.y*9.));
    }
    float fog=1.-exp(-t*(top?.03:.085));
    col=mix(c,sky*.7+mix(u_c3,u_c1,.25)*.35,fog);
  }
  return col;
}`;

const FLASK = `
float sdTrap(vec2 p,float r1,float r2,float he){
  vec2 k1=vec2(r2,he);vec2 k2=vec2(r2-r1,2.*he);
  p.x=abs(p.x);
  vec2 ca=vec2(p.x-min(p.x,(p.y<0.)?r1:r2),abs(p.y)-he);
  vec2 cb=p-k1+k2*clamp(dot(k1-p,k2)/dot(k2,k2),0.,1.);
  float s=(cb.x<0.&&ca.y<0.)?-1.:1.;
  return s*sqrt(min(dot(ca,ca),dot(cb,cb)));
}
float flaskSD(vec2 p){
  float body=sdTrap(p-vec2(0.,-.3),.52,.1,.38)-.05;
  float neck=sdBox2(p-vec2(0.,.4),vec2(.1,.32));
  float lip=sdBox2(p-vec2(0.,.72),vec2(.14,.02))-.01;
  return min(min(body,neck),lip);
}
vec3 scene(vec2 p){
  float od=u_var>.5?1.:0.;
  vec3 col=u_bg+nebula(p*.8+21.)*.7+starfield(p)*.6;
  p.y+=.12;
  float fd=flaskSD(p);
  float inside=1.-smoothstep(-.03,-.015,fd);
  float level=mix(-.42,.02,u_prog)+od*.08;
  float wave=.018*sin(p.x*9.+u_time*2.2)+.012*sin(p.x*17.-u_time*3.1);
  float liq=inside*(1.-smoothstep(level+wave-.005,level+wave+.005,p.y));
  vec2 w=p*2.2+vec2(0.,-u_time*.12);
  float sw=fbm(w+fbm(w*1.6+u_time*.1)*1.5);
  vec3 lc=mix(u_c3,u_c2,smoothstep(.3,.75,sw));
  lc+=u_c1*.5*pow(sw,3.)+starfield(p*2.+sw)*.9;
  col=mix(col,lc*(.8+.5*u_prog),liq);
  col+=u_hot*.9*inside*(1.-smoothstep(.0,.012,abs(p.y-level-wave)));
  /* bubbles: inside they are rings, once out of the neck they become stars */
  for(int i=0;i<16;i++){
    float fi=float(i);
    float h=hash11(fi*3.7+1.),h2=hash11(fi*9.1+4.);
    float ph=fract((u_time+u_spin*4.)*(.09+.1*h)*(1.+od)+h2);
    float y=mix(-.62,1.35,ph);
    float wid=y<.08?mix(.42,.07,clamp((y+.62)/.7,0.,1.)):.06;
    float x=(h2-.5)*2.*wid+.012*sin(u_time*3.+fi);
    float out_=smoothstep(.74,.95,y);
    x+=(h-.5)*1.3*(y-.74)*step(.74,y);
    vec2 b=p-vec2(x,y);
    float rad=.018+.03*h;
    float d=length(b);
    if(y<level){
      col+=mix(u_c2,u_hot,.6)*(1.-smoothstep(.003,.008,abs(d-rad)))*inside;
      col+=u_hot*.8*(1.-smoothstep(.0,.008,length(b-vec2(-.4,.4)*rad)))*inside;
    }else if(y>.74){
      float sp=max(0.,1.-abs(b.x)*abs(b.y)*5000.)*exp(-d*14.);
      col+=mix(u_c1,u_hot,h)*(sp*1.6+1.4*exp(-d*70.))*(1.-smoothstep(.75,1.,ph));
    }
  }
  /* fumes */
  vec2 fp=p-vec2(0.,.8);
  float fum=fbm(vec2(fp.x*4.,fp.y*2.5-u_time*.5))*(1.-smoothstep(.05,.25+fp.y*.5,abs(fp.x)))*smoothstep(0.,.1,fp.y)*(1.-smoothstep(.2,.8,fp.y));
  col+=u_c1*.28*fum*(.6+u_prog);
  /* glass */
  col+=u_c1*(1.-smoothstep(.004,.012,abs(fd)));
  col+=u_hot*.55*(1.-smoothstep(.0,.01,abs(fd+.045)))*smoothstep(-.1,.4,-p.x-p.y*.3)*step(p.y,.1)*.6;
  float tk=step(.5,fract(p.y*10.))*(1.-smoothstep(.0,.004,abs(abs(p.x-.03)-.02)-.02))*step(p.y,-.05)*step(-.55,p.y)*inside;
  col+=u_c1*.5*tk;
  /* burner */
  vec2 q=p-vec2(0.,-.82);
  float fl=fbm(vec2(q.x*7.,q.y*4.-u_time*3.));
  float fw=(.11+.05*od)*(1.-smoothstep(0.,.16+.08*od,q.y))*(.7+.6*fl);
  float flame=(1.-smoothstep(fw*.5,fw,abs(q.x)))*step(0.,q.y);
  col+=mix(u_c2,u_hot,1.-smoothstep(0.,.1,q.y))*flame*1.3;
  col+=u_c1*.8*(1.-smoothstep(.003,.008,abs(sdBox2(q-vec2(0.,-.06),vec2(.2,.04)))));
  col+=u_c1*.6*(1.-smoothstep(.002,.006,abs(p.y+.95)))*step(abs(p.x),.9);
  return col;
}`;

const ASTRO = `
float cap(vec2 p,vec2 a,vec2 b,float r){return sdSeg(p,a,b)-r;}
vec3 lay(vec3 col,vec3 c,float d){return mix(col,c,1.-smoothstep(-.004,.004,d));}
vec3 scene(vec2 p){
  vec3 col=u_bg+nebula(p*.8+31.)*.9+starfield(p+u_mouse*.02);
  /* a ringed planet */
  vec2 pl=p-vec2(-1.05,-.72);
  float pd=length(pl)-.36;
  vec3 pc=mix(u_c3,u_c2,.5+.5*sin(pl.y*24.+3.*fbm(pl*5.)));
  pc*=.35+.65*smoothstep(-.5,.3,dot(pl,normalize(vec2(.6,.7))));
  vec2 rg=rot(.35)*pl;rg.y/=.22;
  float ring=abs(length(rg)-.56)-.05;
  if(rg.y>0.)col=lay(col,u_c1*.7,ring);
  col=lay(col,pc,pd);
  if(rg.y<=0.)col=lay(col,u_c1*.8+u_hot*.15,ring);
  /* a distant fro-rizon */
  vec2 bh=p-vec2(1.05,.62);
  float bd=afroSD(bh,.085,0.);
  col+=mix(u_c1,u_hot,.5)*exp(-abs(bd)*45.)*.8;
  vec2 bq=vec2(bh.x,bh.y/.2);
  col+=u_hot*.8*(1.-smoothstep(.0,.05,abs(length(bq)-.19)))*step(bh.y,0.);
  col=lay(col,u_bg*.3,bd);
  /* the astronaut */
  vec2 q=p-vec2(.03*sin(u_time*.6),.05*sin(u_time*.9)+.02)-u_ptr*vec2(.22,.14);
  q=rot(.1*sin(u_time*.5)-u_mouse.x*.18)*q;
  q/=.92;
  vec3 suit=mix(vec3(.93,.92,.96),u_c1,.18);
  vec3 suitSh=suit*.62;
  vec3 trim=u_c2;
  /* jet puffs */
  for(int i=0;i<6;i++){
    float fi=float(i);
    float ph=fract(u_time*.9+fi*.17);
    vec2 jp=q-vec2((mod(fi,2.)*2.-1.)*.12+.03*sin(fi*9.),-.92-ph*.3);
    col+=mix(u_hot,u_c2,ph)*(1.-smoothstep(.0,.03+.03*ph,length(jp)))*(1.-ph)*.8;
  }
  col=lay(col,suitSh*.8,sdBox2(q-vec2(0.,-.38),vec2(.25,.19))-.05);
  col=lay(col,suitSh,cap(q,vec2(-.1,-.58),vec2(-.13,-.8),.075));
  col=lay(col,suitSh,cap(q,vec2(.1,-.58),vec2(.13,-.8),.075));
  col=lay(col,trim,cap(q,vec2(-.135,-.84),vec2(-.15,-.86),.085));
  col=lay(col,trim,cap(q,vec2(.135,-.84),vec2(.15,-.86),.085));
  col=lay(col,suitSh,cap(q,vec2(-.2,-.28),vec2(-.36,-.46),.065));
  col=lay(col,trim,length(q-vec2(-.38,-.49))-.075);
  float bdy=sdBox2(q-vec2(0.,-.4),vec2(.2,.22))-.08;
  vec3 bc=suit*(.78+.22*smoothstep(-.3,.25,q.x*-1.+q.y*.4+.4));
  col=lay(col,bc,bdy);
  float pan=sdBox2(q-vec2(0.,-.4),vec2(.1,.06))-.015;
  col=lay(col,u_bg*1.4+u_c3*.4,pan);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float bl=step(.5,fract(u_time*(.7+fi*.3)+fi*.4));
    col=lay(col,mix(u_c3,i==1?u_hot:u_c2,.3+.7*bl),length(q-vec2(-.055+fi*.055,-.4))-.017);
  }
  float wa=.95+.45*sin(u_time*4.2+u_spin*9.);
  vec2 sh=vec2(.2,-.26);
  vec2 hand=sh+.27*vec2(cos(wa),sin(wa));
  col=lay(col,suit,cap(q,sh,hand,.065));
  col=lay(col,trim,length(q-hand-.04*vec2(cos(wa),sin(wa)))-.078);
  /* helmet, sized for the hair */
  vec2 hc=q-vec2(0.,.3);
  float hr=u_var>.5?.47:.44;
  float hel=length(hc)-hr;
  col=mix(col,u_bg*.55+u_c3*.3,(1.-smoothstep(-.004,.004,hel))*.82);
  vec2 aq=hc-vec2(0.,.07);
  float sd;
  if(u_var>.5){
    sd=afroSD(aq-vec2(0.,-.05),.2,0.);
    sd=min(sd,afroSD(aq-vec2(-.22,.14),.15,1.));
    sd=min(sd,afroSD(aq-vec2(.22,.14),.15,2.));
  }else{
    sd=afroSD(aq,.3,0.);
  }
  float rim=smoothstep(-.14,0.,sd);
  float cu=curlTex(aq,34.);
  vec3 hair=vec3(.07,.045,.05)+mix(u_c1,u_hot,.4)*(.06+.5*cu)*rim+u_c3*.35*cu*(1.-rim);
  col=lay(col,hair,sd);
  col=face(col,hc-vec2(0.,-.13),.2,1.);
  col+=u_hot*.9*(1.-smoothstep(.004,.012,abs(hel)));
  float gl=(1.-smoothstep(.0,.02,abs(length(hc)-hr*.86)))*smoothstep(.55,.95,dot(normalize(hc+1e-4),normalize(vec2(-.7,.7))));
  col+=vec3(1.)*.55*gl;
  float collar=length((q-vec2(0.,-.12))*vec2(1.,3.2))-.27;
  col=lay(col,mix(u_c1,suit,.3),collar);
  return col;
}`;

const HOME = `
float limbY(float x){return -3.3+sqrt(max(7.84-x*x,0.));}
vec2 rocketPos(float s){float x=.34+.55*s*s;return vec2(x,limbY(.34)+1.75*s);}
vec3 scene(vec2 p){
  vec2 pc=vec2(0.,-3.3);float PR=2.8;
  float rr=length(p-pc);float alt=rr-PR;
  vec3 col=u_bg;
  vec2 sp=rot(.55)*(p+u_ptr*.015);
  float mw=exp(-pow(sp.y*2.1+.35*fbm(sp*1.5)-.2,2.)*3.);
  col+=nebula(p*.9+41.)*(.5+1.3*mw)+starfield(p*1.1+u_ptr*.012)*(1.+mw);
  col+=(u_c1*.12+u_c3*.22)*mw*fbm(sp*4.+3.);
  /* aurora curtains */
  for(int i=0;i<3;i++){
    float fi=float(i);
    float x=p.x*(1.2+fi*.35)+fi*2.1;
    float wv=.12*sin(x*1.7+u_time*.25+fi)+.07*sin(x*3.9-u_time*.18);
    float h=p.y-(-.22+fi*.17+wv);
    float cur=smoothstep(0.,.04,h)*exp(-h*(3.4-fi*.6))*(.45+.55*fbm(vec2(x*4.+u_time*.25,fi*7.)));
    float rays=.55+.45*sin(x*38.+fbm(vec2(x*3.,u_time*.2))*8.);
    col+=mix(u_c2,u_c1,fi*.5)*cur*rays*.42*(1.+u_energy);
  }
  /* sunrise on the limb */
  float sa=.3+u_ptr.x*.07;
  vec2 sun=pc+(PR+mix(-.07,.045,u_prog))*vec2(sin(sa),cos(sa));
  float sd=length(p-sun);
  float sunProx=exp(-abs(p.x-sun.x)*1.5)*(.45+u_prog);
  float vis=smoothstep(-.012,.012,alt);
  float atm=exp(-max(alt,0.)*mix(15.,7.5,u_prog));
  col+=mix(u_c1,u_c2,.35)*atm*(.3+1.1*sunProx)*vis;
  col+=u_hot*atm*atm*sunProx*.9*vis;
  col+=u_hot*(exp(-sd*8.)*(.35+1.1*u_prog)+2.2*exp(-sd*42.))*vis;
  col+=u_hot*.7*exp(-abs(p.y-sun.y)*70.)*exp(-abs(p.x-sun.x)*2.2)*(.3+u_prog)*vis;
  /* shooting stars: one on a timer, one wherever you click */
  for(int i=0;i<2;i++){
    float age=i==0?fract(u_time*.13)*7.:u_click.z;
    vec2 st=i==0?vec2(-1.1+2.*hash11(floor(u_time*.13)),.75):u_click.xy;
    vec2 hd=st+vec2(-1.3,-.55)*age;
    float dl=sdSeg(p,hd,hd+vec2(.3,.127)*min(age*3.,1.));
    col+=u_hot*(1.-smoothstep(.0,.008,dl))*(1.-smoothstep(.2,.9,age))*step(age,1.)*vis*1.5;
  }
  if(alt<0.){
    /* the night side */
    float s=-alt;
    float th=atan(p.x-pc.x,p.y-pc.y)+u_time*.004;
    vec2 sf=vec2(th*8.,sqrt(s)*4.5);
    float land=fbm(sf*1.2+3.);
    vec3 pl=u_bg*.45+u_c3*.1*land;
    vec2 g=sf*24.;float gh=hash21(floor(g));
    float pt=(1.-smoothstep(.08,.3,length(fract(g)-.5)))*step(.55,gh)*smoothstep(.5,.6,land);
    pl+=mix(u_hot,u_c1,gh)*pt*(.6+.4*sin(u_time*2.+gh*40.))*(1.-.6*exp(-s*5.));
    pl+=mix(u_c2,u_c1,.4)*exp(-s*26.)*(.5+1.5*sunProx);
    pl+=u_c1*.2*exp(-s*6.)*sunProx;
    col=pl;
  }
  /* skyline on the horizon: twin spires, a bridge, a city */
  float yb=limbY(p.x);
  float h=p.y-yb;
  float ax=abs(p.x);
  float dx=abs(ax-.085);
  float Ht=dx<.011?.36:(dx<.021?.31:(dx<.031?.25:(dx<.041?.17:0.)));
  Ht=max(Ht,dx<.003?.42:0.);
  float bx=floor(p.x*28.);
  float Hb=(.025+.11*hash11(bx+7.)*(1.-smoothstep(.12,.85,ax)))*step(.14,fract(p.x*28.));
  float bridge=step(ax,.085)*step(.13,h)*step(h,.146);
  float sil=step(h,max(Ht,Hb))*step(-.03,h);
  sil=max(sil,bridge);
  if(sil>.5){
    vec2 wg=vec2(p.x*150.,h*110.);
    float wh=hash21(floor(wg));
    float win=step(.72,wh)*step(.25,fract(wg.x))*step(.3,fract(wg.y))*step(.5,fract(u_time*.05+wh*9.)+.35);
    col=u_bg*.22+mix(u_hot,u_c2,step(.9,wh))*win*.85;
  }
  col+=u_hot*step(.5,fract(u_time*.9))*exp(-length(vec2(dx,h-.425))*110.)*1.5;
  /* the launch: scroll lifts it */
  float sn=u_prog*1.05;
  float dmin=9.;float sat=0.;
  for(int i=0;i<14;i++){
    float s0=float(i)/14.*sn,s1=float(i+1)/14.*sn;
    float d=sdSeg(p,rocketPos(s0),rocketPos(s1));
    if(d<dmin){dmin=d;sat=s1;}
  }
  float trail=exp(-dmin*55.)*(.25+.75*sat/max(sn,.001))*step(.01,sn);
  col+=mix(u_c2,u_hot,.6)*trail*.9;
  float hd=length(p-rocketPos(sn));
  col+=u_hot*(2.*exp(-hd*60.)+.5*exp(-hd*12.))*step(.01,sn);
  return col;
}`;

const NEBULA = `
vec3 scene(vec2 p){
  vec2 q=p+u_ptr*.04;
  float t=u_time*.03;
  vec2 w=vec2(fbm(q*1.1+vec2(t,0.)),fbm(q*1.1+vec2(5.2,-t)));
  float n=fbm(q*1.3+2.2*w+7.);
  float n2=fbm(q*2.6-1.7*w+vec2(1.7,9.2)+t);
  float ridge=1.-abs(2.*fbm(q*1.9+w*2.+13.)-1.);
  float dens=smoothstep(.25,.8,n);
  vec3 gas=mix(u_c3,u_c1,smoothstep(.3,.7,n2));
  gas=mix(gas,u_c2,smoothstep(.5,.9,n*n2*2.2));
  gas=mix(gas,u_hot,pow(dens,5.)*.7);
  float lane=smoothstep(.7,.95,ridge)*.7;
  float lp=exp(-length(p-u_ptr)*2.4);
  vec3 col=u_bg*.6+starfield(q*1.2)*(1.-dens*.75);
  col+=gas*dens*(.7+1.5*lp+.35*u_prog)*(1.-lane);
  /* pillars */
  float cx=q.x*1.5+.25*fbm(vec2(q.y*1.4,q.x*.8)+w);
  float colm=smoothstep(.08,.8,.5+.5*cos(cx*TAU*.62+1.));
  float ph=-1.1+1.25*colm*(.55+.6*fbm(vec2(floor(cx*.62+.66)*3.7,2.)))+.2*u_prog;
  float pe=q.y+.2*fbm(q*4.+w*1.5)+.06*fbm(q*13.);
  float pil=1.-smoothstep(ph-.3,ph+.02,pe);
  float rimE=smoothstep(.02,.3,pil)*(1.-smoothstep(.3,.75,pil));
  col=mix(col,u_bg*.3+gas*.14*(1.+2.*lp),pil*.94);
  col+=mix(u_c1,u_hot,.4)*rimE*(.07+.9*lp)*(.5+fbm(q*9.));
  /* newborn stars ignite as you scroll; the cursor is one more */
  for(int i=0;i<8;i++){
    float fi=float(i);
    vec2 sp=i==7?u_ptr:vec2((hash11(fi*3.3+1.)-.5)*3.,(hash11(fi*7.7+2.)-.25)*1.5);
    float on=i==7?.7+u_energy:smoothstep(fi/8.,fi/8.+.12,u_prog+.3);
    vec2 d=p-sp;float dl=length(d);
    float pulse=.8+.2*sin(u_time*(1.5+fi*.3)+fi);
    float spike=exp(-abs(d.x)*70.)*exp(-abs(d.y)*5.)+exp(-abs(d.y)*70.)*exp(-abs(d.x)*5.);
    col+=mix(u_hot,i==7?u_c2:u_c1,.25)*on*pulse*(1.3*exp(-dl*30.)+.22*exp(-dl*6.)+.4*spike);
  }
  return col;
}`;

const BODIES: Record<SceneId, string> = {
  home: HOME,
  nebula: NEBULA,
  warp: WARP,
  afroHole: AFRO,
  neural: NEURAL,
  printer: PRINTER,
  gears: GEARS,
  city: CITY,
  flask: FLASK,
  astro: ASTRO,
};

export const sceneSource = (id: SceneId): string => COMMON + BODIES[id] + MAIN;
