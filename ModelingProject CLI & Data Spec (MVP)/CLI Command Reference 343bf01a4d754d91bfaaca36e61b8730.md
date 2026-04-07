# CLI Command Reference

<aside>
🧭

This page is the command reference hub for the ModelingProject CLI.

Each child page documents **one CLI command** with:

- purpose
- syntax
- expected output format
- one concrete example
</aside>

<aside>
🧭

**Direction classification**: this command hub now corresponds to **Option A / Embedded Schema Management**.

That means schema-related commands remain inside `em`, including command/event field management.

If you want the split-CLI direction, use the parallel hub here:

[Option B CLI Command Reference](Option%20B%EF%BC%9A%E7%BB%84%E5%90%88%E5%BC%8F%20Schema%20Management%20CLI%20%E6%96%B9%E6%A1%88/Option%20B%20CLI%20Command%20Reference%203aa5c77c2b7840cc98f4d11c238adec4.md)

</aside>

### Shared output envelope

All commands should return a consistent top-level envelope.

#### Success

```json
{
  "ok": true,
  "command": "em ...",
  "projectId": "proj_...",
  "draftId": "draft_...",
  "revisionId": "rev_...",
  "data": {},
  "warnings": []
}
```

#### Failure

```json
{
  "ok": false,
  "command": "em ...",
  "projectId": "proj_...",
  "draftId": "draft_...",
  "error": {
    "code": "ERR_CODE",
    "message": "Human-readable explanation",
    "details": {}
  },
  "warnings": []
}
```

### Conventions

- `projectId` is present when a project context exists.
- `draftId` is present when the command runs inside a draft.
- `revisionId` is present when the command resolves or creates a revision.
- `data` is command-specific and documented on each child page.
- `warnings` is always an array.

### Command groups

- Project / Draft / Versions
- Story
- UI
- Schema
- ViewModel fields
- Automation
- Explore / Review

[em show](CLI%20Command%20Reference/em%20show%200f918fb4cf7d40dc9b5f2de599ac7651.md)

[em neighbors](CLI%20Command%20Reference/em%20neighbors%2055b73ebd28d2407eb642baf66b70f57c.md)

[em walk](CLI%20Command%20Reference/em%20walk%20f9d22d6f435d4c9293c2725830bd311a.md)

[em graph](CLI%20Command%20Reference/em%20graph%20bdc700b688324c5c9b44596ebd23de1a.md)

[em trace](CLI%20Command%20Reference/em%20trace%20cadc86a88dae4278b740d3b5f5092d17.md)

[em validate](CLI%20Command%20Reference/em%20validate%20e5a56ba29aad4da1b20adb95e55e8fad.md)

[em review](CLI%20Command%20Reference/em%20review%2083488421b0224a0b92e062b6162e7009.md)

[em review impact evt](CLI%20Command%20Reference/em%20review%20impact%20evt%200e865643b4bd4791aa66533114f82f8f.md)

[em review impact field](CLI%20Command%20Reference/em%20review%20impact%20field%20cfaa1796fbbe47bcb8bd8428455a1912.md)

[em story add](CLI%20Command%20Reference/em%20story%20add%20220058b373704225b5cbae838e7bf492.md)

[em story tree](CLI%20Command%20Reference/em%20story%20tree%20916c2529383d4d7296a77e763fc0f92e.md)

[em story suggest-bind](CLI%20Command%20Reference/em%20story%20suggest-bind%20e1d3dd96e452492ebac13f1011e9b9bb.md)

[em story revise-bind](CLI%20Command%20Reference/em%20story%20revise-bind%204d91a7f3813445e992b2c9689fd3593d.md)

[em story confirm-bind](CLI%20Command%20Reference/em%20story%20confirm-bind%20a77e5b4f55954476b34cbdf6125f28d7.md)

[em story bind](CLI%20Command%20Reference/em%20story%20bind%20b63d1c956cec40159cd95c9c381a7d8f.md)

[em ui add](CLI%20Command%20Reference/em%20ui%20add%201ef547e0d6b9414b88acf950b27df54c.md)

[em ui tree](CLI%20Command%20Reference/em%20ui%20tree%20a5eff8ccfe5f4441a8ddda5a12422a07.md)

[em ui bind-view](CLI%20Command%20Reference/em%20ui%20bind-view%20759d5a7f797143b383841c3615e94e35.md)

[em ui expose-cmd](CLI%20Command%20Reference/em%20ui%20expose-cmd%20042ba0d6b646424e9c3adc4d3a367cfe.md)

[em cmd new](CLI%20Command%20Reference/em%20cmd%20new%208c0b90fd910b4d049dd44bcb4c499592.md)

[em evt new](CLI%20Command%20Reference/em%20evt%20new%203c5559ebc9ed4ceca34107279124f371.md)

[em view new](CLI%20Command%20Reference/em%20view%20new%2081439966d00045ca8b995a27835ff103.md)

[em project init](CLI%20Command%20Reference/em%20project%20init%201084f0819d2e4c2680e3eb244124fb35.md)

[em project open](CLI%20Command%20Reference/em%20project%20open%20aa6c2920198f485281793f68b38003ca.md)

[em ctx](CLI%20Command%20Reference/em%20ctx%209f42c5f724cd487fa62c638a1cce4dcb.md)

[em draft start](CLI%20Command%20Reference/em%20draft%20start%209224980325ec4015860391e8ba429373.md)

[em draft status](CLI%20Command%20Reference/em%20draft%20status%200881e6df2a3e451cbcb46793d2590582.md)

[em draft diff](CLI%20Command%20Reference/em%20draft%20diff%20a116b8bda73c40f69fea1421d9778ce9.md)

[em submit](CLI%20Command%20Reference/em%20submit%2017121232c0a2433db384b4fa824eafed.md)

[em versions](CLI%20Command%20Reference/em%20versions%201045fb23bc47438b9d8680f33d3310c3.md)

[em checkout](CLI%20Command%20Reference/em%20checkout%206dcf9c31615a4a928b3f13a250168d78.md)

[em link cmd->evt](CLI%20Command%20Reference/em%20link%20cmd-%20evt%2002cce2b2a97b46d1ad17dc84a8f393c7.md)

[em link evt->view](CLI%20Command%20Reference/em%20link%20evt-%20view%2038af9033a1704fd780dcb149ac98272b.md)

[em view field add](CLI%20Command%20Reference/em%20view%20field%20add%2068c7c9e325c64d37a7656a28c6a9ade3.md)

[em view field edit](CLI%20Command%20Reference/em%20view%20field%20edit%20db251d3d2b51408a8f1cbfd825500176.md)

[em view field rm](CLI%20Command%20Reference/em%20view%20field%20rm%20e5b308d1081643c8a5da4f2f57057289.md)

[em view schema show](CLI%20Command%20Reference/em%20view%20schema%20show%20ea447a1031d345c5a3fb528e14ec53fb.md)

[em proc new](CLI%20Command%20Reference/em%20proc%20new%20753e52cd829845aea28f796cabea77a3.md)

[em proc bind-view](CLI%20Command%20Reference/em%20proc%20bind-view%20eaf62031eb814090bef0dcf3e7962a00.md)

[em trigger new](CLI%20Command%20Reference/em%20trigger%20new%2028a4da188a994be19370e5a94d534ef2.md)

[em trigger issues-cmd](CLI%20Command%20Reference/em%20trigger%20issues-cmd%20b9335b352a4a4f47bad5618017a3089f.md)