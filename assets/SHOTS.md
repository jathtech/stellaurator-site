# The website's screenshots: the contract

The owner's rules (2026-10-10): every screenshot is a good screen, every screenshot is a different
view (another book, another chapter, or at least other lines), every screenshot is full resolution
when it is enlarged (the `@2x` file behind the click), and every screenshot shows the feature in
use: a tool open on a clip, the portraits chosen, the list filled, never an empty screen. The
books in the pictures are public-domain novels (Pride and Prejudice, The Adventures of Sherlock
Holmes, Treasure Island, The Wonderful Wizard of Oz); the practice book that comes with the studio
appears in two pictures at most.

Every entry below is one asset: `assets/<name>.jpg` at the width the page lays it out at, and
`assets/<name>@2x.jpg` at twice that, from one capture of the studio at 1600x1100 CSS pixels and
device scale 2 (3200x2200), cropped where the entry says. The HTML carries `srcset` with both and
`data-full` with the 2x file; the lightbox shows the 2x file and zooms it 1:1.

| name | page | what it shows | book, chapter, state |
|---|---|---|---|
| `shot-studio` | index | the whole studio: the strip, the chapter list, the manuscript with a take on most visible lines, the timeline | Pride and Prejudice, chapter 3, lines 1-9 with built-in-voice takes, the cast colored |
| `shot-stages` | index | the strip across the top, cropped (1600x92) | The Wonderful Wizard of Oz, a chapter part recorded, "2 of 24 chapters recorded" or similar |
| `shot-line` | index | one line, its take box with suggested fixes, the spool columns (crop about 1284x250) | Treasure Island, chapter 2, a line part way down |
| `shot-prompter` | index, narrators | the teleprompter mid-read: the band on a line in the middle of the chapter, recording running | The Adventures of Sherlock Holmes, A Scandal in Bohemia |
| `shot-finish` | index | Finish after Diagnose: the chapter's numbers and the report filled | The Wonderful Wizard of Oz, chapter 4, Audiobook master chosen |
| `shot-prooflisten` | index | Proof listen part way through: ticks on three or more heard lines, the playing line large | Pride and Prejudice, chapter 1 |
| `shot-library` | index | the library with five books and their counts | all four novels and the practice book |
| `shot-direction` | studio | the direction control itself, on its own demo page (B:\stellaurator-direction, `npm run demo`, theme gold): the web, the live preview, the faders, the presets; 1600x1200, not 1100, because the whole control is the picture | a line from Treasure Island (Jim in the apple barrel), fear 80, tension 72, interest 46, urgency +30, restraint +40 |
| `shot-tags` | studio | Character Tags with good portraits chosen for the leads, the gallery beside | Pride and Prejudice: Elizabeth, Darcy, Jane, Mr. Bennet, Mrs. Bennet |
| `shot-cast` | studio | the cast list with a voice and a color per character | The Wonderful Wizard of Oz: Dorothy, the Scarecrow, the Tin Woodman, the Lion, the Witch |
| `shot-recording` | studio | Settings, Recording, with the live meter moving and a microphone chosen | any book open |
| `shot-import` | studio, narrators | Bring your recordings: a file cut into lines, matched, uncertain and not found listed | Treasure Island, chapter 1, cut on the pauses |
| `shot-restoration` | studio | the repair screen with a tool open under a clip: before and after visible | the practice book (1 of 2) |
| `shot-clippool` | studio | one line with its recording and the fixes suggested under it, Review showing | the practice book (2 of 2) |
| `shot-takes` | studio | one line with three takes in different voices, one picked (crop about 395x440) | The Adventures of Sherlock Holmes, chapter 2 |
| `shot-tuning` | studio | the tidy-up settings (crop about 284x668) | any book open |
| `shot-timeline` | studio | the chapter timeline with music and a sound effect placed, the current track lit (crop about 1600x188) | Treasure Island, chapter 3 |
| `shot-cuesheet` | studio | the list of music moments for a chapter with three or more cues | The Wonderful Wizard of Oz, chapter 2, cues placed by hand |
| `shot-pickups` | studio, narrators | the Pickups list with three marked lines, reasons filled | Pride and Prejudice, chapter 5 |
| `shot-export` | studio | the export window with its choices and warnings (crop about 544x446) | The Wonderful Wizard of Oz |
| `shot-computers` | studio | Settings, Account, the computers list (crop about 800x230) | any book open |
| `shot-spools` | studio | spools A and B side by side with different takes picked on two lines | The Adventures of Sherlock Holmes, chapter 3 |
| `shot-voices` | voices | the voice picker open on a character, the built-in voices listed | Treasure Island, Long John Silver |
| `shot-part` | narrators | Record a part set up: the part chosen, the pace and band controls, the count-in | Treasure Island, chapter 4 |
| `shot-proofmark` | narrators | Proof listen with a line just marked to record again (the mark showing) | The Wonderful Wizard of Oz, chapter 6 |
| `themes/<theme>` | themes | the studio in each of the twelve themes, each on a different chapter and scroll | rotate the four novels and their chapters |

Captures that cannot be posed honestly (a screen that needs a service the shoot engine does not
have) are left out and said so; the page then goes without that figure. A screenshot is never a
mock-up, and the book in the picture is never a stand-in for a real screen.
