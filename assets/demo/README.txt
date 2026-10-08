The "Hear it" section of the home page (site/index.html, #hear).

It stays hidden until demo.json exists in this folder and lists at least one pair. Each pair is ONE
take heard twice: as it was performed, and after the actor pass put it in a character's voice.

  demo.json
  [
    { "line": "You were never supposed to find this place.", "character": "Captain Okoye",
      "performed": "okoye-performed.mp3", "converted": "okoye-converted.mp3" },
    ...
  ]

Three pairs is plenty (say: a man, a woman, a creature - all from the same performer), each one line,
5 to 10 seconds, MP3 at about 128 kbps. In the app: record the line, run the actor pass, then export
both takes of that line (the raw take and the converted one) and drop them here with the names above.
Keep the whole folder small - tools/deploy-site.sh refuses any file over 20 MB.
Real takes only: this is the product's proof, so never a stand-in.
