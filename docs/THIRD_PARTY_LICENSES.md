# Third-Party Software

Caesar Games has no runtime CDN dependencies. All runtime code is served from
the same origin and included in the PWA offline cache.

## chess.js 1.4.0

- Project: `jhlywa/chess.js`
- Exact npm version: `1.4.0`
- Release commit (`gitHead` from npm): `ce1ff9e9fc342984ff75ca475ab39f37888cb28a`
- Repository: <https://github.com/jhlywa/chess.js>
- npm package: <https://www.npmjs.com/package/chess.js/v/1.4.0>
- License: BSD-2-Clause
- npm tarball SHA-1: `edc1439492d1a0d7f530ba72b2b5398baece28a1`
- npm integrity:
  `sha512-BBJgrrtKQOzFLonR0l+k64A98NLemPwNsCskwb+29bRwobUa4iTm51E1kwGPbWXAcfdDa18nad6vpPPKPWarqw==`
- Audited tarball SHA-256:
  `dce92e280439d7a16f645be94f22e6da50e579a1f3011d0a2381755bfe2c2ef7`
- Vendored ESM file SHA-256:
  `76c7c34f0e2e9ab076521a5d6fe786a9cce537bb1b6f29d32a9c9970b5b232d2`
- Distributed file used: `dist/esm/chess.js`, copied to
  `js/vendor/chessjs/chess.js`
- License copy: `js/vendor/chessjs/LICENSE`

The downloaded npm tarball was inspected before integration. It includes the
source, CommonJS/ESM distributions, type declarations, README and LICENSE. The
package declares zero runtime dependencies. BSD-2-Clause requires preservation
of its copyright notice, conditions and disclaimer; the exact license is
distributed beside the vendored file and is reproduced below.

```text
Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

## Xiangqi implementation

No third-party Xiangqi code or visual assets were copied. The rules engine, AI
and interface in `js/games/xiangqi/` are original Caesar Games code written
from the documented rules authority in `docs/XIANGQI_V1_RULESET.md`.

### Browser/engine audit performed 2026-07-28

The following existing implementations were inspected as architecture/license
references only. None was copied, vendored or linked at runtime:

- **Fairy-Stockfish** — mature multi-variant engine with Xiangqi support,
  GPL-3.0. Rejected for V1 because its copyleft/source-distribution obligations
  and high-strength engine scope are unnecessary for the requested local
  family opponent.
- **xiangqiboard.js 0.3.3** — MIT browser board renderer. Rejected because it
  is a board widget rather than a rules authority and would bring a separate
  visual/interaction layer into the recovered Caesar Games shell.
- **markdirish/xiangqi** — browser JavaScript rules/search/GUI repository.
  Rejected because no license file or clear grant was visible in the audited
  repository listing; ambiguous code is not reusable.
- **ryoi/xiangqi** — MIT browser game with rules and alpha-beta AI. Rejected as
  an implementation source because its own README describes it as a first
  experimental project and notes Chess.com-inspired UI. Caesar Games neither
  needs its code nor may copy that visual direction.

Pikafish and Stockfish were intentionally not added. The V1 AIs are original,
small local searches whose Relaxed/Standard distinction is covered by tests.
