import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { corpus } from '@/lib/corpus';
import { worldContent } from '../world-content';

const content = worldContent(corpus);

describe('worldContent for the real corpus', () => {
  it('carries the brief: bio summary, the Chapter 01 beat and its stat', () => {
    expect(content.headline).toBe('Full-Stack Developer');
    expect(content.location).toBe('Kuala Lumpur, Malaysia');
    expect(content.summary).toMatch(/keen eye for design/);
    expect(content.brief).toMatch(/^Full-stack developer in Kuala Lumpur/);
    expect(content.stats).toEqual([{ value: 6, suffix: ' yrs', caption: 'shipping software' }]);
  });

  it('gives every skill, project tech and operating system a vendored same-origin icon, so WebGL can load it', () => {
    expect(content.skills.length).toBeGreaterThan(3);
    const icons = [
      ...content.skills.flatMap((group) => group.skills),
      ...content.projects.flatMap((project) => project.tech),
      ...content.operatingSystems.flatMap((group) => group.systems),
    ];
    expect(content.skills[0].skills[0]).toEqual({ name: 'Ruby', icon: '/icons/ruby.svg' });
    for (const { name, icon } of icons) {
      expect(name.length, icon).toBeGreaterThan(0);
      expect(icon, name).toMatch(/^\/icons\/[a-z0-9-]+\.(svg|png)$/);
      expect(existsSync(resolve(process.cwd(), 'public', icon.slice(1))), icon).toBe(true);
    }
    expect(content.operatingSystems.map((group) => group.name)).toContain('Linux Environment');
  });

  it('refuses an icon that scripts/vendor-icons.mjs has not downloaded', () => {
    const remote = 'https://cdn.example.com/elixir.svg';
    const skills = [...corpus.skills, { category: 'New', skills: [{ name: 'Elixir', lightImage: remote, darkImage: remote }] }];
    expect(() => worldContent({ ...corpus, skills })).toThrow(/elixir\.svg.*vendor-icons/);
  });

  it('carries project pictures and links, career highlights, logos and links, fun facts, side projects and contact', () => {
    const moodify = content.projects.find((project) => project.slug === 'moodify')!;
    expect(moodify).toMatchObject({ title: 'Moodify', image: '/moodify-cover.svg', url: 'https://github.com/OriginalByteMe/Moodify' });
    expect(moodify.tech.map((tech) => tech.name)).toEqual(['TypeScript', 'React', 'Node.js']);
    expect(content.career[0]).toEqual({
      company: 'MerchantSpring', role: 'Senior AI Engineer', period: '2026 - Present', logo: '/logos/merchantspring.svg', url: 'https://merchantspring.io',
      highlights: ['Building marketplace analytics for e-commerce sellers and agencies', 'Full-stack work across the platform: backend services, data pipelines, and frontend'],
    });
    expect(content.funFacts).toContain('Self-hosts on Proxmox + Unraid');
    expect(content.sideProjects.map((side) => [side.title, side.url])).toEqual([['3D Printing', null], ['My blog!', 'https://blog.noahrijkaard.com']]);
    expect(content.contact).toEqual({ email: 'noahrijkaard@gmail.com', github: 'https://github.com/OriginalByteMe', linkedin: 'https://www.linkedin.com/in/noah-rijkaard/', blog: 'https://blog.noahrijkaard.com' });
  });

  it('survives a JSON round trip, so the server page can hand it to client components', () => {
    expect(JSON.parse(JSON.stringify(content))).toEqual(content);
  });
});
