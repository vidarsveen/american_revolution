// chapter-3-undergjaer, skrevet som prosa. Kapittel-JSON kompileres fra denne
// fila og er det motoren laster; --check sier om de to fortsatt sier det samme.
//
//     python tools/author.py content/beer/script.chapter-3-undergjaer.md --check
//     python tools/author.py content/beer/script.chapter-3-undergjaer.md --write
//     python tools/narrate.py --chapter beer/chapter-3-undergjaer --lang no
//
// KAPITLET ER SPEILET AV KAPITTEL TO. Der var det vannet under én by som
// gjorde stilen; her er det kulda. Samme mønster, motsatt årsak, og det er
// meningen at det skal kjennes igjen: et sted har noe det ikke har valgt, det
// blir til en stil, stilen får navn etter stedet, og så drar stilen.
//
// Forskjellen er hva som skjer etterpå. Burton ga fra seg hemmeligheten og
// beholdt navnet. Plzeň ga fra seg hemmeligheten og fikk hele verden til å
// lage etterligninger — nitti prosent av all øl som drikkes i dag er en
// kopi av det som kom ut av det ene karet i attenhundreogførtito.
//
// `bed: none` står på scene fem, der ølet blir gyllent. Det er kapitlets
// vendepunkt, og stillhet bærer det bedre enn et teppe.

---
id: chapter-3-undergjaer
pack: beer
title: Kulden i Bayern | The cold in Bavaria
subtitle: Lager, is, og en gyllen øl fra Plzeň | Lager, ice, and a golden beer from Plzeň
---

# places
munchen  48.1374, 11.5755  zoom=9.4  kind=city  München | Munich
plzen  49.7475, 13.3776  zoom=10.2  kind=town  Plzeň | Pilsen
alpene  47.3, 11.4  zoom=7.0  kind=hill  Alpene | The Alps
europa  50.5, 9.0  zoom=4.6  kind=region  Europa | Europe

# ending
say: Kulda gjorde ølet rent, og Plzeň gjorde det gyllent. Neste gang: mannen som fanget gjæren. | The cold made the beer clean, and Plzeň made it golden. Next time: the man who caught the yeast.
figure.value: 90
figure.label: prosent av all øl i dag er en kopi av det | per cent of all beer today is a copy of it

## Den som synker | The one that sinks
bed: bedBrew

{plate gjaer-bunnfall motion=in over=24 dim=0.14 push=0.09 into=1.4} Sist gang fløt gjæren opp. Denne synker.
> Last time the yeast floated up. This one sinks.
Den samler seg i et tett lag på bunnen av karet i stedet for på toppen, og den vil ha det kaldt.
> It gathers in a dense layer at the bottom of the vessel instead of on top, and it wants to be cold.

Det heter undergjæring, {mark term:undergjaering} og ølet heter lager. {mark term:lager}
> That is called bottom fermentation, {^} and the beer is called lager. {^}
Fire til ni grader. En kjeller om vinteren, ikke et rom du bor i.
> Four to nine degrees. A cellar in winter, not a room you live in.

Og der ale er ferdig på tre døgn, bruker denne tre uker.
> And where an ale is done in three days, this one takes three weeks.

## Kulda er kontrollen | The cold is the control
bed: bedBrew

{plate.hide 1.1} {plate lagerkjeller-tanker motion=left over=25 dim=0.15 push=0.14 into=1.4} Husk hva varmen gjorde. Gjæren fikk hastverk og sølte estere: banan, pære, eple. {mark term:ester}
> Remember what the heat did. The yeast got hurried and spilled esters: banana, pear, apple. {^}
Kulde gjør det motsatte. Gjæren jobber sakte og ryddig, og lager nesten ingenting ved siden av.
> Cold does the opposite. The yeast works slowly and tidily, and makes almost nothing on the side.

{compare part=3 "3" ale Ale, døgn | Ale, days part=21 "21" lager Lager, døgn | Lager, days mode=bar note=Så lenge tar gjæringen. | This is how long fermentation takes.} Det gir et øl uten frukt i.
> That gives a beer with no fruit in it.
Og et øl uten frukt i er et øl der du hører malten og humla helt alene. Det er ikke tommere. Det er renere.
> And a beer with no fruit in it is a beer where you hear the malt and the hops entirely on their own.

{compare.clear} {plate.hide 1.1} {plate kjeller-kald motion=in over=24 dim=0.16 push=0.08 into=1.4} Ordet lager betyr rett og slett lagring. {mark term:lagring} Ølet blir stående kaldt i uker etter at gjæringen er over.
> The word lager simply means storage. {^} The beer stands cold for weeks after fermentation is finished.
Da faller gjæren ut, smaken glatter seg, og ølet blir blankt.
> The yeast drops out, the flavour smooths itself, and the beer turns bright.

Men det krever noe de fleste steder ikke hadde. Det krever kulde du kan stole på gjennom hele sommeren.
> But that needs something most places did not have. It needs cold you can rely on all summer.

## Bayern, is og fjell | Bavaria, ice and mountains
bed: bedBrew

{flyTo munchen zoom=5.6 over=3.8} {marker munchen label=München kind=point} Sør i Tyskland ligger Bayern, og over Bayern ligger Alpene.
> In southern Germany lies Bavaria, and above Bavaria lie the Alps.
{plate is-hogging motion=out over=24 dim=0.15 push=0.15 into=1.4} Om vinteren hogde de is ut av fjellvann og kjørte den ned i kjellere gravd inn i fjellsiden.
> In winter they cut ice out of mountain water and carted it down into cellars dug into the hillside.

Isen lå der til langt ut på sommeren. Kjelleren holdt fire grader året rundt.
> The ice lay there well into the summer. The cellar held four degrees all year.

{plate.hide 1.1} {plate kjeller-kald motion=in over=26 dim=0.16 push=0.08 into=1.4} Og i den kjelleren trivdes en gjær som ikke trivdes noe annet sted.
> And in that cellar there thrived a yeast that thrived nowhere else.
Ingen valgte den. Den var bare den som overlevde kulda, brygg etter brygg, i noen hundre år.
> Nobody chose it. It was simply the one that survived the cold, brew after brew, for a few hundred years.

Bayern gjorde det til lov også. Fra femtenhundretallet var det forbudt å brygge om sommeren.
> Bavaria made it law as well. From the fifteen hundreds it was forbidden to brew in summer.
Man brygget fra september til april, og lagret resten av året. Ølet måtte tåle å vente.
> You brewed from September to April, and stored the rest of the year. The beer had to be able to wait.

## Loven som glemte den fjerde | The law that forgot the fourth
bed: bedBrew

{plate.hide 1.1} {plate tre-ingredienser motion=in over=23 dim=0.14 push=0.09 into=1.4} I femtenhundreogseksten kom det en lov i Bayern som fortsatt er berømt.
> In fifteen sixteen a law arrived in Bavaria that is still famous.
Den het reinheitsgebot, {mark term:reinheitsgebot} renhetspåbudet, og den sa hva øl fikk være laget av.
> It was called the Reinheitsgebot, {^} the purity order, and it said what beer was allowed to be made of.

Tre ting. Vann, bygg og humle.
> Three things. Water, barley and hops.

{plate.hide 1.1} {plate gjaerkake-krukke motion=in over=22 dim=0.14 push=0.09 into=1.4} Legg merke til hva som ikke står der. Gjæren.
> Notice what is not on the list. The yeast.
Den var ikke utelatt. Den var ukjent. Ingen visste at den fantes, og loven kunne ikke nevne noe ingen hadde sett.
> It was not left out. It was unknown. Nobody knew it existed, and the law could not name something nobody had seen.

Så den viktigste ingrediensen i øl sto ikke i loven om hva øl er, i tre hundre år.
> So the most important ingredient in beer was not in the law about what beer is, for three hundred years.

## Attenhundreogførtito | Eighteen forty-two
bed: none

{flyTo plzen zoom=6.6 over=4.0} {marker.clear} {marker plzen label=Plzeň kind=point tone=gold} Fire mil øst for grensa ligger en by i Böhmen.
> Forty kilometres east of the border lies a town in Bohemia.
{plate plzen-bryggeri motion=in over=25 dim=0.15 push=0.08 into=1.4} I attenhundreogtrettiåtte var innbyggerne så misfornøyde med sitt eget øl at de rullet seksogtretti tønner ut på torget og tømte dem i rennesteinen.
> In eighteen thirty-eight the townspeople were so unhappy with their own beer that they rolled thirty-six barrels into the square and emptied them into the gutter.

Så bygde de et nytt bryggeri og hentet en brygger fra Bayern.
> Then they built a new brewery and brought in a brewer from Bavaria.

{plate.hide 1.1} {plate lys-malt motion=in over=24 dim=0.14 push=0.09 into=1.4} Han tok med seg den kalde gjæren. Men fire ting til møttes i den byen på én gang.
> He brought the cold yeast with him. But four more things met in that town at once.
Vannet under Plzeň er nesten uten mineraler. {mark term:blott-vann} Det mykeste bryggevannet i Europa.
> The water under Plzeň is almost free of minerals. {^} The softest brewing water in Europe.
Malten var tørket på den nye engelske måten, med varm luft i stedet for over ild, så den kom ut blek i stedet for brun.
> The malt was dried the new English way, with hot air instead of over a fire, so it came out pale instead of brown.

{plate.hide 1.1} {plate pilsner-glass motion=in over=27 dim=0.13 push=0.08 into=1.4} Og akkurat i de årene ble glass billig nok til at vanlige folk drakk av det, i stedet for av tinn eller stein.
> And in exactly those years glass became cheap enough for ordinary people to drink from, instead of pewter or stoneware.

Ølet kom ut av kjelleren gyllent. Klart, blekt og gyllent, i et glass du kunne se gjennom.
> The beer came out of the cellar golden. Clear, pale and golden, in a glass you could see through.
Ingen hadde sett øl se sånn ut før. {mark term:pilsner}
> Nobody had seen beer look like that before. {^}

## Og så kopierte alle | And then everybody copied it
bed: bedBrew

{plate.hide 1.1} {flyTo europa zoom=4.6 over=4.6} {marker plzen label=Plzeň kind=point tone=gold} {marker munchen label=München kind=point} Det som skjedde etterpå er den største smittingen i ølets historie.
> What happened next is the biggest contagion in the history of beer.
Jernbanen kom samtidig. Ølet kunne reise kaldt, og det gjorde det.
> The railway arrived at the same time. The beer could travel cold, and it did.

{stat 90% label=av all øl i dag er blek lager | of all beer today is pale lager side=lager} I dag er omtrent ni av ti øl som drikkes i verden en etterligning av det ene karet.
> Today about nine out of ten beers poured in the world are an imitation of that one vessel.

{stat.clear} Og her er det bitre. Plzeň klarte ikke å beskytte navnet sitt.
> And here is the bitter part. Plzeň could not protect its name.
Pilsner ble et vanlig ord for en type øl, ikke for et sted. Burton beholdt i det minste navnet sitt i burtonisering.
> Pilsner became an ordinary word for a kind of beer, not for a place. Burton at least kept its name in Burtonisation.

## Det som ble borte | What went missing
bed: bedBrew

{plate.hide 1.1} {marker.clear} {plate pils-rekke motion=in over=24 dim=0.15 push=0.09 into=1.4} Tenk på hva det betyr. Ni av ti glass i verden smaker av det samme valget.
> Think about what that means. Nine out of ten glasses in the world taste of the same choice.
Blek malt, lite humle, kald gjær, og ingenting som stikker seg fram.
> Pale malt, few hops, cold yeast, and nothing that sticks out.

Det er ikke dårlig øl. Det er vanskelig øl å lage, fordi det ikke er noe å gjemme seg bak.
> It is not bad beer. It is difficult beer to make, because there is nothing to hide behind.
Men det er ett svar på spørsmålet vårt, gjentatt ni ganger av ti.
> But it is one answer to our question, repeated nine times out of ten.

{plate.hide 1.1} {plate gjaerkake-krukke motion=out over=22 dim=0.14 push=0.12 into=1.4} Og fortsatt, i attenhundreogsyttiårene, visste ingen brygger nøyaktig hva gjæren var.
> And still, in the eighteen seventies, no brewer knew exactly what the yeast was.
De arvet den, de skummet den, de håpet. Noen ganger ble et helt bryggeri surt uten at noen skjønte hvorfor.
> They inherited it, they skimmed it, they hoped. Sometimes an entire brewery went sour and nobody understood why.

Neste gang drar vi til København, der en mann satte én eneste celle under et mikroskop og forandret alt sammen.
> Next time we go to Copenhagen, where one man put a single cell under a microscope and changed the whole thing.
