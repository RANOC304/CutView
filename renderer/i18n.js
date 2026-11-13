'use strict';

const STRINGS = {
  fr: {
    'empty.text': 'Ouvrez une vidéo, ou déposez-en une n’importe où dans cette fenêtre.',
    'empty.open': 'Ouvrir une vidéo',
    'busy.convert': 'Ce format nécessite une courte conversion avant de pouvoir être prévisualisé…',
    'common.cancel': 'Annuler',
    'drop.hint': 'Déposez la vidéo pour l’ouvrir',
    'seek.title': 'Cliquez pour aller à un moment précis',
    'btn.open': 'Ouvrir une vidéo (Ctrl+O)',
    'btn.framePrev': 'Image précédente ( , )',
    'btn.back': 'Reculer de 5 s (←)',
    'btn.play': 'Lecture / Pause (Espace)',
    'btn.fwd': 'Avancer de 5 s (→)',
    'btn.frameNext': 'Image suivante ( . )',
    'btn.speed': 'Vitesse de lecture',
    'btn.mute': 'Muet (M)',
    'btn.volume': 'Volume (↑ / ↓)',
    'btn.full': 'Plein écran (F)',
    'ed.startHere': 'Début ici',
    'ed.startHere.title': 'Faire commencer la nouvelle vidéo au moment actuel (I)',
    'ed.endHere': 'Fin ici',
    'ed.endHere.title': 'Faire finir la nouvelle vidéo au moment actuel (O)',
    'ed.preview': 'Aperçu',
    'ed.preview.title': 'Lire uniquement la partie sélectionnée',
    'ed.reset': 'Réinitialiser',
    'ed.reset.title': 'Sélectionner de nouveau toute la vidéo',
    'ed.start': 'Début',
    'ed.end': 'Fin',
    'ed.length': 'Durée',
    'ed.settings': 'Paramètres',
    'ed.settings.title': 'Paramètres',
    'ed.export': 'Exporter',
    'ed.export.title': 'Enregistrer la partie sélectionnée dans une nouvelle vidéo (Ctrl+E)',
    'ed.handleL': 'Glissez pour définir le début',
    'ed.handleR': 'Glissez pour définir la fin',
    'ed.hint': 'Glissez les poignées ambrées pour couper. Elles s’aimantent sur la ligne rouge (le moment actuel) quand vous vous en approchez.',
    'ed.snapped': 'aimanté sur le curseur',
    'set.title': 'Paramètres',
    'set.language': 'Langue',
    'set.folder': 'Dossier d’export par défaut',
    'set.notSet': 'Non défini',
    'set.browse': 'Parcourir…',
    'set.clear': 'Effacer',
    'set.folderNote': 'Dossier dans lequel la fenêtre « Enregistrer sous » s’ouvre quand <b>Demander l’emplacement</b> est activé.',
    'set.ask': 'Demander l’emplacement',
    'set.askOn': 'Une fenêtre « Enregistrer sous » s’ouvre avant chaque export.',
    'set.askOff': 'Désactivé : la nouvelle vidéo est enregistrée automatiquement à côté de l’original.',
    'set.fast': 'Export rapide',
    'set.fastNote': 'Copie la vidéo sans la ré-encoder. Beaucoup plus rapide, mais la coupe peut tomber un peu à côté du point choisi.',
    'set.done': 'Terminé',
    'exp.title': 'Export en cours…',
    'exp.choose': 'Choisissez où enregistrer la vidéo…',
    'exp.starting': 'Démarrage…',
    'toast.wait': 'Veuillez attendre la fin de la conversion en cours.',
    'toast.cantPlay': 'Cette vidéo ne peut pas être lue : {error}',
    'toast.cantPlayShort': 'Cette vidéo ne peut pas être lue.',
    'toast.unsupported': 'format non pris en charge',
    'toast.saved': 'Enregistré : {path}',
    'toast.show': 'Afficher dans le dossier',
    'toast.exportFailed': 'Échec de l’export : {error}',
    'toast.unknown': 'erreur inconnue',
  },
  en: {
    'empty.text': 'Open a video, or drop one anywhere in this window.',
    'empty.open': 'Open a video',
    'busy.convert': 'This format needs a quick conversion before it can be previewed…',
    'common.cancel': 'Cancel',
    'drop.hint': 'Drop the video to open it',
    'seek.title': 'Click to jump to a moment',
    'btn.open': 'Open a video (Ctrl+O)',
    'btn.framePrev': 'Previous frame ( , )',
    'btn.back': 'Back 5 s (←)',
    'btn.play': 'Play / Pause (Space)',
    'btn.fwd': 'Forward 5 s (→)',
    'btn.frameNext': 'Next frame ( . )',
    'btn.speed': 'Playback speed',
    'btn.mute': 'Mute (M)',
    'btn.volume': 'Volume (↑ / ↓)',
    'btn.full': 'Fullscreen (F)',
    'ed.startHere': 'Start here',
    'ed.startHere.title': 'Start the new video at the current moment (I)',
    'ed.endHere': 'End here',
    'ed.endHere.title': 'End the new video at the current moment (O)',
    'ed.preview': 'Preview',
    'ed.preview.title': 'Play only the selected part',
    'ed.reset': 'Reset',
    'ed.reset.title': 'Select the whole video again',
    'ed.start': 'Start',
    'ed.end': 'End',
    'ed.length': 'Length',
    'ed.settings': 'Settings',
    'ed.settings.title': 'Settings',
    'ed.export': 'Export',
    'ed.export.title': 'Save the selected part as a new video (Ctrl+E)',
    'ed.handleL': 'Drag to set the start',
    'ed.handleR': 'Drag to set the end',
    'ed.hint': 'Drag the amber handles to trim. They snap onto the red line (the current moment) when you get close.',
    'ed.snapped': 'snapped to playhead',
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.folder': 'Default export folder',
    'set.notSet': 'Not set',
    'set.browse': 'Browse…',
    'set.clear': 'Clear',
    'set.folderNote': 'Where the “Save as” window opens when <b>Ask path</b> is on.',
    'set.ask': 'Ask path',
    'set.askOn': 'A “Save as” window opens before every export.',
    'set.askOff': 'Off: the new video is saved automatically next to the original.',
    'set.fast': 'Fast export',
    'set.fastNote': 'Copies the video without re-encoding. Much quicker, but the cut can land a moment away from the chosen point.',
    'set.done': 'Done',
    'exp.title': 'Exporting…',
    'exp.choose': 'Choose where to save the video…',
    'exp.starting': 'Starting…',
    'toast.wait': 'Please wait for the current conversion to finish.',
    'toast.cantPlay': 'This video can’t be played: {error}',
    'toast.cantPlayShort': 'This video can’t be played.',
    'toast.unsupported': 'unsupported format',
    'toast.saved': 'Saved {path}',
    'toast.show': 'Show in folder',
    'toast.exportFailed': 'Export failed: {error}',
    'toast.unknown': 'unknown error',
  },
};

let currentLang = 'fr';
try {
  const saved = localStorage.getItem('lang');
  if (saved && STRINGS[saved]) currentLang = saved;
} catch {}

function tr(key, vars) {
  let s = (STRINGS[currentLang] && STRINGS[currentLang][key]) ?? STRINGS.fr[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

function applyI18n() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = tr(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = tr(el.dataset.i18nHtml)));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = tr(el.dataset.i18nTitle)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = tr(el.dataset.i18nPh)));
}

function setLanguage(lang) {
  if (!STRINGS[lang]) lang = 'fr';
  currentLang = lang;
  try { localStorage.setItem('lang', lang); } catch {}
  applyI18n();
}

applyI18n();
