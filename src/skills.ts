import fs from 'fs';
import path from 'path';

export const SKILLS_DIR = path.join(process.cwd(), 'skills');

export interface Skill {
  name: string;
  description?: string;
  body: string;
  filePath: string;
}

export type SkillSelection = string[] | 'all';

export function listAvailableSkills(skillsDir = SKILLS_DIR): Skill[] {
  if (!fs.existsSync(skillsDir)) return [];

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSkill(path.join(skillsDir, entry.name), entry.name))
    .filter((skill): skill is Skill => Boolean(skill))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function loadSelectedSkills(selection: SkillSelection, skillsDir = SKILLS_DIR): Skill[] {
  const available = listAvailableSkills(skillsDir);
  if (selection === 'all') return available;

  const wanted = new Set(selection);
  return available.filter((skill) => wanted.has(skill.name));
}

export function parseSkillSelection(value: unknown): SkillSelection {
  if (value === 'all') return 'all';
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  throw new Error('skills must be "all" or a JSON array of skill names');
}

function readSkill(skillDir: string, fallbackName: string): Skill | null {
  const filePath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const parsed = parseFrontmatter(raw);
  return {
    name: parsed.metadata.name || fallbackName,
    description: parsed.metadata.description,
    body: parsed.body.trim(),
    filePath,
  };
}

function parseFrontmatter(raw: string): { metadata: Record<string, string>; body: string } {
  if (!raw.startsWith('---\n')) return { metadata: {}, body: raw };

  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { metadata: {}, body: raw };

  const metadata: Record<string, string> = {};
  const frontmatter = raw.slice(4, end).trim();
  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value) metadata[key] = value;
  }

  return { metadata, body: raw.slice(end + 4).trim() };
}
