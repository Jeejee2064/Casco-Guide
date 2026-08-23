/**
 * WhatsApp deep link for a Panama mobile number, or `null` when the phone
 * on file isn't one (landline, foreign number, or unset) — WhatsApp only
 * makes sense for a real mobile line. Panama mobiles are 8 digits starting
 * with 6 (e.g. 6123-4567); landlines are 7 digits starting with 2–5 or 7.
 * The admin's phone field is free text (spaces, dashes, parens, an
 * optional +507/00507 country code all show up in practice), so this
 * strips everything down to digits before checking.
 */
export function panamaWhatsAppUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00507")) digits = digits.slice(5);
  else if (digits.startsWith("507") && digits.length > 8) digits = digits.slice(3);

  if (digits.length !== 8 || !digits.startsWith("6")) return null;
  return `https://wa.me/507${digits}`;
}
