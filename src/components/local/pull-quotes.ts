/**
 * Pull quotes for guides, routes and areas. Every line is a sentence from that page's own markdown:
 * Reading.astro drops any line it cannot find in the body, so a quote can never drift from the text.
 */
export const PULL_QUOTES: Record<string, string[]> = {
  "cost-to-rent-a-car-in-lahore": ["If you need a car for three weeks, always ask what a month would cost.", "Book early, and check whether peak date pricing applies to your car: a good quote says so plainly."],
  "documents-to-rent-a-car-in-pakistan": ["The paperwork for renting a car in Pakistan is simple once you know what to bring.", "The licence must be valid for the whole rental period."],
  "lahore-to-northern-areas-road-trip-guide": ["It is also a serious undertaking: long days, high passes, changing weather and roads that can close without warning.", "Always add one or two spare days on longer trips.", "Book early for summer and Eid holidays: SUVs and vans are the first cars to go."],
  "renting-a-car-in-lahore-overseas-pakistanis": ["Sorting out a car before you land saves you the first-day scramble and the favours from relatives.", "A good approach is to take a driver for the first few days and switch to self drive later."],
  "self-drive-vs-car-with-driver-lahore": ["For a quiet week of errands, self drive usually wins.", "A common approach is to book a driver for the first few days and move to self drive once you are comfortable."],

  "lahore-to-faisalabad": ["The motorways are quick and quiet compared with the old road through Sheikhupura."],
  "lahore-to-hunza": ["From Lahore it is a serious road trip, and a driver who knows the Karakoram Highway makes all the difference."],
  "lahore-to-islamabad": ["Add a day or two for Murree, continue to Naran and Kaghan in summer, or take the M-1 and Swat Expressway to Swat."],
  "lahore-to-kartarpur-nankana-sahib": ["Two of the holiest places in Sikhism are within a day's drive of Lahore."],
  "lahore-to-multan": ["It is an easy drive, flat and straight, with service areas along the way."],
  "lahore-to-murree": ["Murree is the hill station Lahore escapes to, in summer for the cool air and in winter for the snow."],
  "lahore-to-naran-kaghan": ["Naran is the base, and with a driver who knows the mountain road, the long drive becomes part of the holiday."],
  "lahore-to-sialkot": ["A same day return is easy: about four hours of driving in total."],
  "lahore-to-skardu": ["It is also one of the longest road trips you can take from Lahore, and one of the most rewarding."],
  "lahore-to-swat": ["The Swat Expressway has made it a much easier trip from Lahore than it used to be."],
  "lahore-to-wagah-border": ["It is a short drive from the city, but timing matters."],

  askari: ["That makes it one of the easiest places in Lahore for a 4 am flight or a late night arrival."],
  "bahria-town-lahore": ["With a driver, the commute becomes time you can use."],
  "dha-lahore": ["DHA Lahore is not one neighbourhood but a string of phases, each with its own character, gates and traffic patterns."],
  gulberg: ["Gulberg is where Lahore does business by day and eats out by night."],
  "johar-town": ["On big days the roads around it slow right down and parking fills early."],
  "lahore-cantt": ["Our office is in Lahore Cantt, so this is the part of the city we know best."],
  "model-town": ["Model Town families often host functions at home and in nearby marquees."],
  "wapda-town": ["A car with a driver turns that time into something useful."],
};
