# AGENTS.md

Panduan singkat untuk sesi OpenCode di repo ini. Hanya hal yang mudah salah tanpa petunjuk.

## Proyek

API monitoring kesuburan tanah: Express 5 + Supabase, di-deploy ke Vercel. Dashboard statis di `public/dashboard/` (HTML/CSS/JS vanilla, Chart.js dari CDN). Tidak ada framework frontend dan tidak ada build step.

## Perintah

- Jalankan server: `node server.js` (port dari `PORT`, default 3000)
- Mode pantau: `nodemon server.js` (nodemon terpasang, tetapi belum ada script npm-nya)
- `npm start` **gagal**: `package.json` belum punya script `start`
- `npm test` **sengaja gagal**: masih placeholder `exit 1`. Tidak ada test di repo ini
- `main` di `package.json` menunjuk `index.js` yang tidak ada. Abaikan; entrypoint sebenarnya `server.js`

## Jalan lokal butuh sertifikat

`server.js` menjalankan HTTPS dan membaca `./certs/server.key` + `./certs/server.crt`, hanya saat file dijalankan langsung (`require.main === module`, `server.js:207`). Folder `certs/` ada di `.gitignore`, jadi clone baru akan gagal start sampai sertifikat lokal dibuat.

Saat Vercel meng-import file ini, blok tersebut dilewati dan `module.exports = app` (`server.js:218`) yang dipakai.

## Struktur

`server.js` memuat seluruh backend (218 baris): middleware auth, validasi, semua endpoint, dan listen lokal. Tidak ada file backend lain.

## Yang sering salah

- `express.static()` di `server.js:11` **diabaikan Vercel**. File statis disajikan Vercel dari `public/**`, bukan Express. Jangan pindahkan dashboard keluar dari `public/`.
- `authenticateApiKey` dipasang di `POST /api/soil` (`:37`) dan `GET /api/soil` (`:172`), **tidak** di `GET /api/soil/latest` (`:138`). Itu disengaja: dashboard belum punya login, jadi endpoint terbaru harus publik. Jangan "memperbaiki" ini tanpa menambahkan login dulu.
- Jangan menaruh `API_KEY` atau kunci Supabase di `public/**`. Semua isi folder itu terbuka untuk publik.

## Kontrak data

Request device memakai nama pendek, database memakai nama kolom berbeda. Alias ada di `SOIL_SELECT` (`server.js:135`).

| Request dan respons | Kolom database |
|---|---|
| `ph` | `pH` |
| `temperature` | `Temp` |
| `moisture` | `Hum` |
| `nitrogen` / `phosphorus` / `potassium` | `N` / `P` / `K` |
| `ec` | `EC` |
| `classification` | `ai_label` |

Tabel: `soil_measurements`. Tidak ada kolom `device_id` (sengaja).

**Konfirmasi dulu sebelum dipakai.** Pada sesi terakhir, proyek Supabase yang aktif dilaporkan memakai tabel `kesuburan_tanah` dengan kolom huruf kecil `temp` dan `hum`, plus tabel `user` untuk login. Kode dan `docs/PRD.md` masih memakai `soil_measurements` dengan `Temp` dan `Hum`. Selisih ini membuat `POST /api/soil` gagal, jadi cek langsung ke Supabase sebelum mengandalkan salah satunya.

## Bentuk respons

Sukses: `{ success: true, message, data }`. Gagal: `{ success: false, message }`, ditambah `error` pada kegagalan database. Status: `201` simpan, `200` baca, `400` validasi, `401` kunci salah atau tidak ada, `500` server.

Validasi `POST /api/soil` menolak string angka (`"6.2"`), tetapi menerima `0`. Itu disengaja.

## Env

`.env` ada di `.gitignore`. Jangan pernah di-commit, di-screenshot, atau ditempel ke chat. Isinya: `SUPABASE_URL`, `SUPABASE_KEY`, `API_KEY`, `PORT`. Nilai yang sama harus ada di Environment Variables Vercel.

## Dokumen

- `docs/PRD.md`: kebutuhan produk (Indonesia). Memuat pemetaan field, aturan validasi, skema tabel, dan daftar known issue. Ini acuan kontrak API.
- `docs/KEAMANAN.md`: autentikasi, autorisasi, validasi, tabel ancaman, dan checklist uji. Sebagian besar masih rancangan, bukan kode.
- `docs/RANGKUMAN.md`: blueprint bangun ulang, memuat SQL tabel dan kerangka `server.js`.
- `docs/design.md`: acuan UI dashboard.
- Tidak ada README. Dokumentasi ada di `docs/`.

## Konvensi

- Bahasa antarmuka dan dokumentasi: Indonesia.
- Dashboard tanpa build step: ubah `public/dashboard/index.html`, `style.css`, atau `app.js`, lalu refresh.
- Endpoint baru ikut bentuk respons di atas.
- `.opencode/skills/antislop/SKILL.md` berlaku untuk pekerjaan UI, teks, orang, layout mobile, dan komentar kode. Blok penunjuknya ada di akhir file ini, jangan dihapus.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.opencode/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.opencode/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.opencode/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.opencode/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.opencode/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.opencode/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->
