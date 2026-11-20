import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "mr";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
];

const en = {
  "nav.home": "Home", "nav.search": "Search", "nav.sell": "Sell", "nav.account": "Account",
  "search.placeholder": "Search movies, matches, concerts…",
  "hero.title": "Can't make it? Pass it on.",
  "hero.sub": "Buy and resell genuine tickets at or below face value. Full price shown upfront — no hidden fees.",
  "hero.cta.buy": "Find tickets", "hero.cta.sell": "Sell a ticket",
  "trust.protection": "Buyer Protection", "trust.protection.d": "Full refund if your ticket is rejected at entry.",
  "trust.cap": "Face-value cap", "trust.cap.d": "Resale never above what the seller paid, unless local rules allow.",
  "trust.fees": "No hidden fees", "trust.fees.d": "Price, fees and GST shown before you pay.",
  "auth.title": "Sign in to PassOn", "auth.phone": "Mobile number", "auth.sendOtp": "Send OTP",
  "auth.otp": "Enter the 6-digit OTP", "auth.verify": "Verify & continue", "auth.google": "Continue with Google",
  "auth.or": "or", "auth.signout": "Sign out", "auth.signin": "Sign in",
  "onb.title": "Complete your profile", "onb.name": "Full name", "onb.state": "State", "onb.lang": "Preferred language",
  "onb.consent": "Your consent", "onb.save": "Save and continue",
  "consent.terms": "I agree to the Terms of Use and Privacy Policy (required)",
  "consent.transactions": "Process my data to complete purchases, sales, payouts and refunds (required)",
  "consent.marketing": "Send me offers and event alerts (optional)",
  "consent.analytics": "Use my activity to improve PassOn (optional)",
  "consent.personalisation": "Personalise event recommendations (optional)",
  "settings.title": "Settings", "settings.profile": "Profile", "settings.phone": "Phone verification",
  "settings.payout": "Payout details", "settings.privacy": "Privacy & data", "settings.download": "Download my data",
  "settings.delete": "Delete my account", "settings.save": "Save",
  "sell.gate": "Before you can list tickets", "sell.ready": "You're ready to sell",
  "footer.legal": "Legal", "footer.tag": "India's fair ticket resale marketplace.",
  "legal.terms": "Terms of Use", "legal.refund": "Refund & Buyer Protection", "legal.privacy": "Privacy Policy",
  "legal.grievance": "Grievance Officer", "legal.cookies": "Cookie Notice",
};
type Dict = Record<keyof typeof en, string>;

const hi: Dict = {
  "nav.home": "होम", "nav.search": "खोजें", "nav.sell": "बेचें", "nav.account": "खाता",
  "search.placeholder": "फ़िल्में, मैच, कॉन्सर्ट खोजें…",
  "hero.title": "नहीं जा पा रहे? टिकट आगे बढ़ाइए।",
  "hero.sub": "असली टिकट फ़ेस वैल्यू या उससे कम में खरीदें और बेचें। पूरी कीमत पहले ही दिखेगी — कोई छिपा शुल्क नहीं।",
  "hero.cta.buy": "टिकट खोजें", "hero.cta.sell": "टिकट बेचें",
  "trust.protection": "खरीदार सुरक्षा", "trust.protection.d": "एंट्री पर टिकट अस्वीकार हुआ तो पूरा रिफ़ंड।",
  "trust.cap": "फ़ेस वैल्यू सीमा", "trust.cap.d": "विक्रेता द्वारा चुकाई कीमत से ज़्यादा में दोबारा बिक्री नहीं।",
  "trust.fees": "कोई छिपा शुल्क नहीं", "trust.fees.d": "भुगतान से पहले कीमत, शुल्क और GST दिखेंगे।",
  "auth.title": "PassOn में साइन इन करें", "auth.phone": "मोबाइल नंबर", "auth.sendOtp": "OTP भेजें",
  "auth.otp": "6 अंकों का OTP डालें", "auth.verify": "सत्यापित करें", "auth.google": "Google से जारी रखें",
  "auth.or": "या", "auth.signout": "साइन आउट", "auth.signin": "साइन इन",
  "onb.title": "अपनी प्रोफ़ाइल पूरी करें", "onb.name": "पूरा नाम", "onb.state": "राज्य", "onb.lang": "पसंदीदा भाषा",
  "onb.consent": "आपकी सहमति", "onb.save": "सहेजें और आगे बढ़ें",
  "consent.terms": "मैं उपयोग की शर्तों और गोपनीयता नीति से सहमत हूँ (आवश्यक)",
  "consent.transactions": "खरीद, बिक्री, भुगतान और रिफ़ंड के लिए मेरा डेटा उपयोग करें (आवश्यक)",
  "consent.marketing": "मुझे ऑफ़र और इवेंट अलर्ट भेजें (वैकल्पिक)",
  "consent.analytics": "PassOn सुधारने के लिए मेरी गतिविधि का उपयोग करें (वैकल्पिक)",
  "consent.personalisation": "इवेंट सुझाव मेरे अनुसार बनाएँ (वैकल्पिक)",
  "settings.title": "सेटिंग्स", "settings.profile": "प्रोफ़ाइल", "settings.phone": "फ़ोन सत्यापन",
  "settings.payout": "भुगतान विवरण", "settings.privacy": "गोपनीयता और डेटा", "settings.download": "मेरा डेटा डाउनलोड करें",
  "settings.delete": "मेरा खाता हटाएँ", "settings.save": "सहेजें",
  "sell.gate": "टिकट लिस्ट करने से पहले", "sell.ready": "आप बेचने के लिए तैयार हैं",
  "footer.legal": "कानूनी", "footer.tag": "भारत का निष्पक्ष टिकट रीसेल बाज़ार।",
  "legal.terms": "उपयोग की शर्तें", "legal.refund": "रिफ़ंड और खरीदार सुरक्षा", "legal.privacy": "गोपनीयता नीति",
  "legal.grievance": "शिकायत अधिकारी", "legal.cookies": "कुकी सूचना",
};

const mr: Dict = {
  "nav.home": "मुख्यपृष्ठ", "nav.search": "शोधा", "nav.sell": "विका", "nav.account": "खाते",
  "search.placeholder": "चित्रपट, सामने, कॉन्सर्ट शोधा…",
  "hero.title": "जाता येत नाही? तिकीट पुढे द्या.",
  "hero.sub": "खरी तिकिटे दर्शनी किमतीत किंवा कमी किमतीत खरेदी-विक्री करा. पूर्ण किंमत आधीच दिसते — कोणतेही लपलेले शुल्क नाही.",
  "hero.cta.buy": "तिकिटे शोधा", "hero.cta.sell": "तिकीट विका",
  "trust.protection": "खरेदीदार संरक्षण", "trust.protection.d": "प्रवेशावेळी तिकीट नाकारल्यास पूर्ण परतावा.",
  "trust.cap": "दर्शनी किंमत मर्यादा", "trust.cap.d": "विक्रेत्याने भरलेल्या किमतीपेक्षा जास्त किमतीत पुनर्विक्री नाही.",
  "trust.fees": "लपलेले शुल्क नाही", "trust.fees.d": "पैसे भरण्याआधी किंमत, शुल्क आणि GST दिसतात.",
  "auth.title": "PassOn मध्ये साइन इन करा", "auth.phone": "मोबाइल नंबर", "auth.sendOtp": "OTP पाठवा",
  "auth.otp": "6 अंकी OTP टाका", "auth.verify": "पडताळा आणि पुढे जा", "auth.google": "Google सह पुढे जा",
  "auth.or": "किंवा", "auth.signout": "साइन आउट", "auth.signin": "साइन इन",
  "onb.title": "तुमची प्रोफाइल पूर्ण करा", "onb.name": "पूर्ण नाव", "onb.state": "राज्य", "onb.lang": "पसंतीची भाषा",
  "onb.consent": "तुमची संमती", "onb.save": "जतन करा आणि पुढे जा",
  "consent.terms": "मी वापराच्या अटी आणि गोपनीयता धोरणाशी सहमत आहे (आवश्यक)",
  "consent.transactions": "खरेदी, विक्री, पेमेंट आणि परताव्यासाठी माझा डेटा वापरा (आवश्यक)",
  "consent.marketing": "मला ऑफर्स आणि इव्हेंट सूचना पाठवा (ऐच्छिक)",
  "consent.analytics": "PassOn सुधारण्यासाठी माझी कृती वापरा (ऐच्छिक)",
  "consent.personalisation": "इव्हेंट सूचना माझ्यानुसार करा (ऐच्छिक)",
  "settings.title": "सेटिंग्ज", "settings.profile": "प्रोफाइल", "settings.phone": "फोन पडताळणी",
  "settings.payout": "पेमेंट तपशील", "settings.privacy": "गोपनीयता आणि डेटा", "settings.download": "माझा डेटा डाउनलोड करा",
  "settings.delete": "माझे खाते हटवा", "settings.save": "जतन करा",
  "sell.gate": "तिकिटे लिस्ट करण्यापूर्वी", "sell.ready": "तुम्ही विक्रीसाठी तयार आहात",
  "footer.legal": "कायदेशीर", "footer.tag": "भारताचा न्याय्य तिकीट पुनर्विक्री बाजार.",
  "legal.terms": "वापराच्या अटी", "legal.refund": "परतावा आणि खरेदीदार संरक्षण", "legal.privacy": "गोपनीयता धोरण",
  "legal.grievance": "तक्रार अधिकारी", "legal.cookies": "कुकी सूचना",
};

export const dictionaries: Record<Lang, Dict> = { en, hi, mr };
export type TKey = keyof typeof en;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("passon.lang");
    if (saved === "hi" || saved === "mr" || saved === "en") setLangState(saved);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => { setLangState(l); localStorage.setItem("passon.lang", l); }, []);
  const t = useCallback((k: TKey) => dictionaries[lang][k] ?? en[k], [lang]);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}
