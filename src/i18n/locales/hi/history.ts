import type { history as en } from '../en/history';
import type { Translation } from '../../types';

export const history: Translation<typeof en> = {
  range: {
    all: 'अब तक',
    '30': '30 दिन',
    '90': '90 दिन',
    year: 'इस साल',
  },
  filterByExercise: 'एक्सरसाइज़ से फ़िल्टर करें',
  filteredBy: '{name} से फ़िल्टर किया गया। फ़िल्टर हटाएँ',
  olderInDrive: 'आपकी ड्राइव में पुराने वर्कआउट ({count})',
  olderInDriveHint: 'वो वर्कआउट दिखाता है जो सिर्फ़ आपके ड्राइव बैकअप में हैं',
  noMatchTitle: 'कोई वर्कआउट नहीं मिला',
  noMatchMessage: 'तारीख की रेंज बड़ी करें या कोई दूसरी एक्सरसाइज़ चुनें।',
  emptyTitle: 'अभी तक कोई वर्कआउट नहीं',
  emptyMessage: 'आपके पूरे किए गए वर्कआउट यहाँ दिखेंगे।',
  goHome: 'होम पर जाएँ',
  workoutCount: { one: '{count} वर्कआउट', other: '{count} वर्कआउट' },
  pickerEmpty: 'आपकी की हुई एक्सरसाइज़ यहाँ दिखेंगी।',
  reps: '{reps} रेप्स',
  seconds: '{s} सेकंड',
  detail: {
    same: 'बराबर',
    removeExerciseTitle: '{name} को इस वर्कआउट से हटाएँ?',
    removeExerciseMessage:
      'इसके सेट हट जाएँगे और आपके रिकॉर्ड फिर से गिने जाएँगे।',
    notFoundTitle: 'वर्कआउट नहीं मिला',
    notFoundMessage: 'शायद इसे हटा दिया गया है।',
    deleteTitle: 'यह वर्कआउट हटाएँ?',
    deleteMessage:
      'यह इस फ़ोन से हट जाएगा, और अगली बार अपडेट होने पर आपके बैकअप से भी।',
    deleted: 'वर्कआउट हटा दिया गया',
    savedAsRoutine: 'रूटीन के रूप में सेव हो गया',
    duration: 'समय',
    volumeUnit: 'वॉल्यूम, {unit}',
    sets: 'सेट',
    rename: 'वर्कआउट का नाम बदलें',
    editHint:
      'बदलाव साथ-साथ सेव होते हैं। हर बदलाव के बाद रिकॉर्ड फिर से गिने जाते हैं।',
    addExercise: '+ एक्सरसाइज़ जोड़ें',
    addExerciseHint:
      'नई एक्सरसाइज़ का सेट भरें और उस पर टिक करें। बिना टिक वाले सेट "हो गया" दबाने पर हट जाएँगे।',
    comparedWith: '{date} से तुलना: वॉल्यूम {volume}',
    comparedE1rm: ', अनुमानित 1-रेप मैक्स {e1rm}',
    versus: '{date} से तुलना:',
    volume: 'वॉल्यूम',
    estE1rm: 'अनु. 1RM',
    firstTime: 'पहली बार किया',
    saveAsRoutine: 'रूटीन के रूप में सेव करें',
    deleteWorkout: 'वर्कआउट हटाएँ',
    workoutName: 'वर्कआउट का नाम',
  },
  drive: {
    reading: 'आपका ड्राइव बैकअप पढ़ रहे हैं…',
    connect:
      'जो वर्कआउट सिर्फ़ बैकअप में हैं उन्हें देखने के लिए Google Drive जोड़ें।',
    readFailed:
      'अभी आपका ड्राइव बैकअप नहीं पढ़ा जा सका। अपना इंटरनेट चेक करें और फिर से कोशिश करें।',
    unavailableTitle: 'ड्राइव हिस्ट्री नहीं मिल रही',
    backupSettings: 'बैकअप सेटिंग्स',
    nothingTitle: 'ड्राइव में कुछ अलग नहीं है',
    nothingMessage: 'आपके ड्राइव बैकअप का हर वर्कआउट इस फ़ोन पर भी है।',
    note: {
      one: '{count} वर्कआउट सिर्फ़ आपकी ड्राइव में है। यहाँ आप इसे सिर्फ़ देख सकते हैं, यह इस फ़ोन में सेव नहीं होता।',
      other:
        '{count} वर्कआउट सिर्फ़ आपकी ड्राइव में हैं। यहाँ आप इन्हें सिर्फ़ देख सकते हैं, ये इस फ़ोन में सेव नहीं होते।',
    },
    rowSummary: '{duration} · {volume} {unit} · {sets} सेट',
    exercise: 'एक्सरसाइज़',
  },
};
