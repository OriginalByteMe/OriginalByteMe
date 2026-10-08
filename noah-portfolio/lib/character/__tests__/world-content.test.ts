import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { corpus } from '@/lib/corpus';
import { skillStationId, worldContent } from '../world-content';

const content = worldContent(corpus);

describe('worldContent for the real corpus', () => {
  it('gives every skill and project tech a vendored same-origin icon, so WebGL can load it', () => {
    const icons = [...content.skills.flatMap((group) => group.skills), ...content.projects.flatMap((project) => project.tech)];
    expect(content.skills[0].skills[0]).toEqual({ name: 'Ruby', icon: '/icons/ruby.svg' });
    for (const { name, icon } of icons) {
      expect(icon, name).toMatch(/^\/icons\/[a-z0-9-]+\.(svg|png)$/);
      expect(existsSync(resolve(process.cwd(), 'public', icon.slice(1))), icon).toBe(true);
    }
  });

  it('refuses an icon that scripts/vendor-icons.mjs has not downloaded', () => {
    const remote = 'https://cdn.example.com/elixir.svg';
    const skills = [...corpus.skills, { category: 'New', skills: [{ name: 'Elixir', lightImage: remote, darkImage: remote }] }];
    expect(() => worldContent({ ...corpus, skills })).toThrow(/elixir\.svg.*vendor-icons/);
  });

  it('carries career highlights and links, and survives a JSON round trip for the client', () => {
    expect(content.career[0]).toMatchObject({ company: 'MerchantSpring', url: 'https://merchantspring.io', highlights: expect.arrayContaining([expect.stringMatching(/marketplace analytics/)]) });
    expect(JSON.parse(JSON.stringify(content))).toEqual(content);
  });

  it('names one lab station per skill group, without stray dashes', () => {
    expect(content.skills.map((group) => skillStationId(group.category))).toEqual([
      'skills:programming-languages', 'skills:ai-llm-tooling', 'skills:frontend-frameworks', 'skills:infrastructure-devops', 'skills:databases',
    ]);
  });
});
