// Kursplan for beer. Dette er nivået over et kapittel: hva kurset lærer bort,
// i hvilken rekkefølge, og hva hvert kapittel er TIL FOR.
// pack.json sin `chapters`-liste er kompilert herfra.
//
//     python tools/outline.py beer
//     python tools/outline.py beer --write
//
// Den vanlige linja er norsk, skrevet først; `>`-linja under er engelsk.
// Les docs/planning.md for hva hvert felt er til for.
//
// Alle seks kapitlene står som `planned: true`. Det er meningen: kursplanen
// skal være ferdig diskutert før første setning skrives, og et kapittel som
// står her uten å finnes er en beslutning, ikke en mangel.

---
pack: beer
---

# question
Hvorfor smaker øl av tusen ting, når det bare er laget av fire?
> Why does beer taste of a thousand things when it is made of four?

# about
Kurset handler om hvordan øl blir til, og om hvorfor ølet fra ett sted smaker
som akkurat det stedet. Vann, korn, humle og gjær — tre av dem kan du veie.
Den fjerde lever, og i fire hundre år var det ingen som visste at den fantes.
Nesten alt i dette kurset skjer fordi noen prøvde å styre noe usynlig.

Rekkefølgen er ikke tilfeldig. Først hva øl ER: fire ingredienser og fire
trinn, uten et eneste stedsnavn. Så de to store gjærtypene, én om gangen, med
hvert sitt land som bevis — England varmt og raskt, Bayern kaldt og langsomt.
Så året gjæren ble fanget i et laboratorium, og hva verden mistet da all øl
kunne smake likt. Til slutt de to som ikke ble med: Belgia, som lot vinduet
stå åpent med vilje, og en norsk gjær som overlevde på et stabbur.

Dette er et kurs om håndverk og historie. Det er ikke en bryggekurs, og det er
ikke et kurs om å drikke: her står ingen oppskrift, ingen merker og ingen
priser.
> The course is about how beer is made, and about why the beer of one place
> tastes like that place. Water, grain, hops and yeast — three of them you can
> weigh. The fourth is alive, and for four hundred years nobody knew it was
> there. Almost everything in this course happens because somebody was trying
> to control something invisible.
>
> The order is not an accident. First what beer IS: four ingredients and four
> steps, without a single place name. Then the two great yeasts, one at a time,
> each with a country as its proof — England warm and quick, Bavaria cold and
> slow. Then the year the yeast was caught in a laboratory, and what the world
> lost when all beer could taste the same. Last, the two that never joined in:
> Belgium, which left the window open on purpose, and a Norwegian yeast that
> survived in a farm loft.
>
> This is a course about craft and history. It is not a brewing course and it
> is not a course about drinking: there is no recipe in it, no brand and no
> price.

# not here
// `oppskrift`/`recipe` sto her og fyrte på "samme malt, samme oppskrift,
// to grader" i kapittel én, som er en helt legitim bruk av ordet. Regelen
// i docs/planning.md er å ikke liste et ord kurset selv trenger.
hjemmebrygging, brygg selv, bryggeoppskrift | homebrewing, brew your own, brewing recipe
merkevare, merker, pris, priser | brand, brands, price, prices
promille, bakrus, rus | units, hangover, drunk
vin, whisky, cider, mjød | wine, whisky, cider, mead

## chapter-1-fire-ting
title: Fire ting i et glass | Four things in a glass
subtitle: Vann, korn, humle og gjær | Water, grain, hops and yeast
blurb: Nesten all øl i verden er laget av fire ting. Vi følger dem gjennom bryggeriet, fra åkeren til glasset, og finner ut hvor smaken kommer fra. | Almost every beer in the world is made of four things. We follow them through the brewery, from the field to the glass, and find out where the taste comes from.
langs: no, en
for: Å gi ordene resten av kurset hviler på, og å legge den store spaken på
     bordet med én gang: tre av de fire ingrediensene kan veies, og den fjerde
     lever. Alt som kommer etterpå er en historie om å styre den levende.
     Kapitlet har ingen stedsnavn i seg, og det er med vilje — spørsmålet
     "hvorfor smaker øl herfra sånn" gir ingen mening før man vet hva øl er.
     Kartet er derfor tomt til nest siste beat, der grunnen kommer til syne
     i samme øyeblikk som setningen sier at stedet begynner å bety noe. Det
     er ett kamerakutt i hele kapitlet, og ingenting er satt på det.
     | To give the words the rest of the course leans on, and to put the big
     lever on the table at once: three of the four ingredients can be weighed
     and the fourth is alive. Everything after this is a story about
     controlling the living one. There is not one place name in the chapter,
     on purpose — "why does beer from here taste like that" means nothing
     until you know what beer is. So the map stays empty until the
     second-to-last beat, where the ground appears at the moment the sentence
     says the place starts to matter. One camera move in the whole chapter,
     and nothing pinned on it.
teaches: malt, mesking, vørter, kok, humle, bitterhet, gjær, gjæring
assumes: 
shows: pictures, process, charts, map

## chapter-2-overgjaer
title: Den som gjærer på toppen | The one that ferments on top
subtitle: Ale, England, og vannet under Burton | Ale, England, and the water under Burton
blurb: Varm gjæring, ferdig på tre dager, og en smak av frukt som ingen har tilsatt. Så en by som oppdaget at vannet under den var halve hemmeligheten. | Warm fermentation, done in three days, and a taste of fruit nobody added. Then a town that found the water under it was half the secret.
langs: no, en
for: Den første av de to gjærtypene, og det første beviset på at et sted kan
     lage en stil. Gipsen i vannet under Burton er grunnen til at en engelsk
     bitter smaker som den gjør, og det er kjemi man kan peke på — bedre enn
     "tradisjon", som forklarer ingenting.
     | The first of the two yeasts, and the first proof that a place can make
     a style. The gypsum in the water under Burton is why an English bitter
     tastes the way it does, and that is chemistry you can point at — better
     than "tradition", which explains nothing.
teaches: ale, overgjæring, ester, porter, stout, gips, ipa, burtonisering, fat
assumes: gjær, gjæring, malt, humle
shows: pictures, map, cards

## chapter-3-undergjaer
title: Kulden i Bayern | The cold in Bavaria
subtitle: Lager, is, og en gyllen øl fra Plzeň | Lager, ice, and a golden beer from Plzeň
blurb: En gjær som synker til bunns og jobber langsomt i kulde. Bayern lagret ølet i kjellere fylt med is — og i 1842 kom det ut gyllent i stedet for brunt. | A yeast that sinks to the bottom and works slowly in the cold. Bavaria stored its beer in cellars packed with ice — and in 1842 it came out golden instead of brown.
langs: no, en
for: Den andre gjærtypen, og ølet som tok over verden. Her er kulden
     kontrollen: langsomt, rent, ingen frukt. Så gjør Plzeň det gyllent — lys
     malt, bløtt vann og glass i stedet for tinnkrus — og resten av verden
     kopierer det i hundre og åtti år.
     | The second yeast, and the beer that took over the world. Here the cold
     is the control: slow, clean, no fruit. Then Plzeň makes it golden — pale
     malt, soft water, and glass instead of pewter — and the rest of the world
     spends a hundred and eighty years copying it.
teaches: lager, undergjæring, lagring, reinheitsgebot, pilsner, bløtt vann
assumes: gjær, gjæring, ester, malt
shows: pictures, map, cards

## chapter-4-renkultur
title: Mannen som fanget gjæren | The man who caught the yeast
subtitle: København, 1883 | Copenhagen, 1883
blurb: En dansk botaniker dyrket fram én eneste gjærcelle og lot den bli til alle de andre. Etterpå kunne øl smake likt hver eneste gang, over hele verden. | A Danish botanist grew a single yeast cell and let it become all the others. After that, beer could taste the same every time, anywhere in the world.
langs: no, en
for: Vendepunktet i kurset. Det usynlige blir en ingrediens man kan bestille i
     posten, og all verdens øl beveger seg mot én smak. Kursets spørsmål får
     sitt egentlige svar her — og regningen kommer i samme kapittel, for det
     er også her det meste av variasjonen forsvinner.
     | The hinge of the course. The invisible thing becomes an ingredient you
     can order in the post, and the world's beer moves towards one taste. The
     course's question gets its real answer here — and the bill arrives in the
     same chapter, because this is also where most of the variety goes.
teaches: renkultur, pasteurisering, gjærbank, industriøl, kvalitetskontroll
assumes: gjær, gjæring, ester, lager, undergjæring
shows: pictures, cards, charts

## chapter-5-belgia
title: De som lot vinduet stå åpent | The ones who left the window open
subtitle: Belgia, og gjæren som kommer utenfra | Belgium, and the yeast that comes in from outside
blurb: Mens resten av verden stengte de ville gjærsoppene ute, bygde et lite område utenfor Brussel takene sine slik at de skulle komme inn. | While the rest of the world was shutting the wild yeasts out, a small area outside Brussels built its roofs so they could get in.
langs: no, en
for: Motargumentet, og det står sterkest rett etter kapittel fire. Alle andre
     brukte fire hundre år på å stenge de ville organismene ute; ett lite
     område lot være med vilje, og lager de rareste ølene på jorda. Det er
     også kapitlet der "feil" og "stil" viser seg å være samme sak.
     | The counter-argument, and it is strongest right after chapter four.
     Everyone else spent four hundred years shutting the wild organisms out;
     one small area chose not to, and makes the strangest beer on earth. It is
     also the chapter where "a fault" and "a style" turn out to be the same
     thing.
teaches: lambik, kjøleskip, spontangjæring, brettanomyces, geuze, kriek, saison, trappist, flaskegjæring
assumes: gjær, gjæring, ale, ester, renkultur
shows: pictures, map, cards

## chapter-6-kveik
title: Kveiken i stabburet | The kveik in the loft
subtitle: Norsk gardsøl, og gjæren som overlevde | Norwegian farmhouse ale, and the yeast that survived
blurb: Mens gjæren ble låst inne i laboratorier, hang det en tørket gjærkrans på et stabbur på Voss. Den tåler tretti grader mer enn den skal, og brukes i dag over hele verden. | While yeast was being locked up in laboratories, a dried ring of it was hanging in a loft in Voss. It survives thirty degrees hotter than it ought to, and today it is used all over the world.
langs: no, en
planned: true
for: Å slutte der seeren står. Kurset åpnet med fire ingredienser og lukker
     sirkelen: det Hansen låste inne i et laboratorium hadde levd videre på
     norske gårder hele tiden, i en trekrans i et stabbur, uten at noen kalte
     det vitenskap. Kapitlet er norsk fordi kurset er skrevet på norsk først,
     og fordi det tilfeldigvis er sant.
     | To end where the viewer is standing. The course opened on four
     ingredients and closes the circle: what Hansen locked in a laboratory had
     been living on Norwegian farms the whole time, in a wooden ring in a
     loft, without anybody calling it science. The chapter is Norwegian
     because the course is written in Norwegian first, and because it happens
     to be true.
teaches: kveik, gardsøl, gjærkrans, høy gjæringstemperatur, håndverksbryggeri, tørrhumling
assumes: gjær, gjæring, ale, humle, ipa, renkultur
shows: pictures, map, cards
