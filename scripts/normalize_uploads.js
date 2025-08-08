#!/usr/bin/env node
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');
const RESERVED_DIRS = new Set(['public', 'thumbs', 'originals', 'paysite', 'store', 'private', 'rejected']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function isImageFile(name){
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXT.has(ext);
}

async function ensureDirs(slug){
  const dirs = [
    path.join(UPLOADS_ROOT, slug, 'public'),
    path.join(UPLOADS_ROOT, slug, 'public', 'gallery'),
    path.join(UPLOADS_ROOT, slug, 'public', 'blurred'),
    path.join(UPLOADS_ROOT, slug, 'thumbs'),
    path.join(UPLOADS_ROOT, slug, 'originals')
  ];
  for (const d of dirs){ await fs.mkdir(d, { recursive: true }); }
}

async function listSlugs(){
  try {
    const entries = await fs.readdir(UPLOADS_ROOT, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (e) {
    return [];
  }
}

async function* walkDir(root, slug){
  const stack = [root];
  while (stack.length){
    const dir = stack.pop();
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries){
      const full = path.join(dir, e.name);
      const rel = path.relative(path.join(UPLOADS_ROOT, slug), full);
      const topSegment = rel.split(path.sep)[0];
      if (e.isDirectory()){
        if (RESERVED_DIRS.has(topSegment)) continue; // skip reserved trees
        stack.push(full);
      } else if (e.isFile()){
        if (RESERVED_DIRS.has(topSegment)) continue;
        if (isImageFile(e.name)) yield { full, rel, name: e.name };
      }
    }
  }
}

async function generateThumb(slug, filename){
  const thumbsDir = path.join(UPLOADS_ROOT, slug, 'thumbs');
  const galleryDir = path.join(UPLOADS_ROOT, slug, 'public', 'gallery');
  const src = path.join(galleryDir, filename);
  const dst = path.join(thumbsDir, filename);
  try { await fs.access(dst); return 'exists'; } catch {}
  await sharp(src).resize(480, 480, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(dst);
  return 'created';
}

async function moveIntoPublic(slug, options){
  const root = path.join(UPLOADS_ROOT, slug);
  const galleryDir = path.join(UPLOADS_ROOT, slug, 'public', 'gallery');
  await ensureDirs(slug);

  let moved = 0;
  let skipped = 0;
  for await (const file of walkDir(root, slug)){
    const destName = await uniqueName(galleryDir, file.name);
    const dest = path.join(galleryDir, destName);
    if (options.copy){
      await fs.copyFile(file.full, dest);
    } else {
      try { await fs.rename(file.full, dest); }
      catch (e) {
        // Cross-device or permission issues: fallback to copy
        await fs.copyFile(file.full, dest);
        try { await fs.unlink(file.full); } catch {}
      }
    }
    moved++;
    if (options.verbose) console.log(`→ ${path.relative(UPLOADS_ROOT, file.full)} -> ${path.relative(UPLOADS_ROOT, dest)}`);
    // generate thumbnail
    try { await generateThumb(slug, destName); } catch (e) { if (options.verbose) console.warn('thumb failed for', destName, e.message); }
  }
  return { moved, skipped };
}

async function uniqueName(targetDir, filename){
  let base = path.basename(filename, path.extname(filename));
  const ext = path.extname(filename);
  let candidate = filename;
  let i = 1;
  while (fssync.existsSync(path.join(targetDir, candidate))){
    candidate = `${base}_${i}${ext}`;
    i++;
  }
  return candidate;
}

async function main(){
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const copy = args.includes('--copy');
  const verbose = args.includes('--verbose');
  const slugArg = args.find(a => !a.startsWith('--')) || process.env.MODEL_SLUG;

  const targets = all ? await listSlugs() : (slugArg ? [slugArg] : []);
  if (!targets.length){
    console.log('Usage: node scripts/normalize_uploads.js <slug> [--copy] [--verbose] | --all');
    process.exit(1);
  }
  for (const slug of targets){
    const modelPath = path.join(UPLOADS_ROOT, slug);
    if (!fssync.existsSync(modelPath)) { console.log(`Skip ${slug}: no uploads folder`); continue; }
    console.log(`Normalizing uploads for ${slug} ...`);
    await ensureDirs(slug);
    const { moved } = await moveIntoPublic(slug, { copy, verbose });
    console.log(`✔ ${slug}: moved ${moved} image(s) into public/gallery and generated thumbs`);
  }
}

main().catch(err => { console.error('normalize_uploads failed:', err); process.exit(2); });


