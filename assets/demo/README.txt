The "Hear the difference" section of the home page (site/index.html, #hear).

It stays hidden until demo.json exists in this folder and lists at least one recording. Every
entry is a REAL recording from the studio: this is the product's proof, so never a stand-in.

  demo.json
  [
    { "kind": "cleanup", "line": "The road ran on past the mill.",
      "before": "mill-recorded.mp3", "after": "mill-finished.mp3" },
    { "kind": "voice", "line": "You were never supposed to find this place.", "character": "Captain Okoye",
      "performed": "okoye-performed.mp3", "converted": "okoye-converted.mp3" },
    { "kind": "excerpt", "title": "From chapter 3 of <the book>", "file": "excerpt.mp3" },
    { "kind": "walkthrough", "title": "From a recording to a finished chapter", "video": "walkthrough.mp4", "poster": "walkthrough.jpg" }
  ]

The four kinds, in the order the owner asked for them (2026-10-10):
  cleanup      the same take as it was recorded and after the clean-up and Finish: "As recorded" / "Cleaned and mastered"
  voice        the same take as it was performed and after the voice change: "As performed" / "As <character>"
  excerpt      one recording from a finished audiobook, 30 to 60 seconds
  walkthrough  a short screen recording of a chapter going from recording to the finished file, with a poster frame
An entry with "performed" and "converted" and no "kind" is a voice pair (the first shape this file had).

Each sound 5 to 60 seconds, MP3 at about 128 kbps; the video under 20 MB (tools/deploy-site.sh refuses
any file over 20 MB). In the app: record the line, run the fixes or the voice change, then export both
takes of that line and drop them here with the names above. Keep the whole folder small.
