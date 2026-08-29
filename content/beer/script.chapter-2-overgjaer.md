// chapter-2-overgjaer, skrevet som prosa. Kapittel-JSON kompileres fra denne
// fila og er det motoren laster; --check sier om de to fortsatt sier det samme.
//
//     python tools/author.py content/beer/script.chapter-2-overgjaer.md --check
//     python tools/author.py content/beer/script.chapter-2-overgjaer.md --write
//     python tools/narrate.py --chapter beer/chapter-2-overgjaer --lang no
//
// DETTE ER KAPITLET DER KARTET BEGYNNER Å JOBBE. Kapittel én hadde ingen
// grunn i det hele tatt — `ground: none` — fordi et kart uten stedsnavn på er
// en skjerm som venter på å få vite hva den er til for. Her er stedsnavnet
// hele poenget: gipsen i vannet under én engelsk by er grunnen til at en
// engelsk bitter smaker som den gjør.
//
// Kartet er likevel ikke det som bærer kapitlet. Bildene bærer det, og kartet
// kommer fram fire ganger — London, Dublin, Burton, og til slutt hele
// nordvest-Europa. Fire kamerabevegelser i ni minutter.
//
// northwest-europe-10m ble bygd for dette. mediterranean-10m stopper på femti
// grader nord, sør for Burton, så uten den fila zoomer scene fire inn i blankt
// papir. `python tools/build-basemap.py --pack beer`.

---
id: chapter-2-overgjaer
pack: beer
title: Den som gjærer på toppen | The one that ferments on top
subtitle: Ale, England, og vannet under Burton | Ale, England, and the water under Burton
---

# places
london  51.5074, -0.1278  zoom=9.6  kind=city  London
dublin  53.3498, -6.2603  zoom=9.6  kind=city  Dublin
burton  52.8019, -1.6360  zoom=11.2  kind=town  Burton upon Trent | Burton upon Trent
nordsjoen  55.0, 3.0  zoom=5.2  kind=region  Nordsjøen | The North Sea

# ending
say: Én gjær, én by, ett vann. Neste gang: den andre gjæren, og kulda som fant den. | One yeast, one town, one water. Next time: the other yeast, and the cold that found it.
figure.value: 3
figure.label: døgn, og en ale er ferdig | days, and an ale is done

## Den som flyter opp | The one that floats up
bed: bedBrew

{plate gjaerkrone-kar motion=in over=24 dim=0.14 push=0.1 into=1.4} Forrige gang endte vi med at stedet begynner å bety noe. Her er stedet.
> Last time we ended with the place starting to matter. Here is the place.
Men først må vi dele gjæren i to, for det finnes to slag, og de gjør to helt forskjellige øl.
> But first we have to split the yeast in two, because there are two kinds, and they make two completely different beers.

Det ene slaget flyter opp. {mark term:ale} Når det har spist seg mett, samler det seg i et tykt, brunt lag på toppen av karet.
> One kind floats up. {^} When it has eaten its fill, it gathers in a thick brown layer on top of the vessel.
Bryggeren kan skumme det av med en spade og bruke det om igjen neste uke.
> The brewer can skim it off with a paddle and use it again next week.

{plate.hide 1.1} {plate skumming-spade motion=left over=22 dim=0.13 push=0.14 into=1.4} Det heter overgjæring, {mark term:overgjaering} og ølet heter ale.
> That is called top fermentation, {^} and the beer is called ale.
Den vil ha det varmt. Atten til tjueto grader, som et rom du ikke fyrer i.
> It likes to be warm. Eighteen to twenty-two degrees, like a room you do not heat.
Og den har hastverk. Tre døgn, og det meste er over.
> And it is in a hurry. Three days, and most of it is over.

Det er verdt å stoppe ved. I tusen år var dette det eneste ølet som fantes i Nord-Europa.
> That is worth stopping at. For a thousand years this was the only beer there was in northern Europe.

## Smaker ingen har tilsatt | Flavours nobody added
bed: bedBrew

{plate ale-glass-lys motion=in over=26 dim=0.14 push=0.08 into=1.4} Når gjæren har det travelt og varmt, søler den.
> When yeast is hurried and warm, it spills.
Ved siden av alkohol lager den noen hundre andre stoffer, i mengder du måler i milliondeler.
> Alongside alcohol it makes a few hundred other compounds, in amounts you measure in parts per million.

Noen av dem heter estere. {mark term:ester} Nesen vår er ubehagelig god til å finne dem.
> Some of them are called esters. {^} Our noses are unpleasantly good at finding them.
{plate.hide 1.1} {plate estere-frukt motion=in over=24 dim=0.13 push=0.09 into=1.4} {fact term:ester} Banan. Pære. Eple. Litt nellik.
> Banana. Pear. Apple. A little clove.

{stat 100 label=ganger sterkere lukt enn smak | times stronger to smell than to taste side=ale} Ingen har hatt frukt i det. Det har aldri vært frukt i nærheten av det.
> Nobody put fruit in it. There has never been fruit anywhere near it.
Det er bare en sopp som har hatt det for varmt og for travelt.
> It is just a fungus that has been too warm and in too much of a hurry.

{stat.clear} Og det er her kurset svinger. For hvor varmt karet står, bestemmer bryggeren.
> And this is where the course turns. Because how warm the vessel stands is the brewer's decision.
{plate.hide 1.1} {plate ale-glass-lys motion=out over=20 dim=0.13 push=0.12 into=1.4} Men hvor varmt det er MULIG å ha det, bestemmer landet du står i.
> But how warm it is POSSIBLE to have it is decided by the country you are standing in.

## England, og et øl for arbeidsfolk | England, and a beer for working people
bed: bedBrew

{flyTo london zoom=5.4 over=3.6} {marker london label=London kind=point} England er mildt.
> England is mild.
{plate london-elv motion=out over=24 dim=0.15 push=0.16 into=1.4} Vintrene er grå og våte, og de går nesten aldri under null.
> The winters are grey and wet, and they almost never drop below freezing.
Et rom i England holder seg av seg selv på den temperaturen ale vil ha.
> A room in England sits by itself at the temperature ale wants.

Så England brygget ale, og gjorde det i mengder ingen hadde sett før.
> So England brewed ale, and did it in quantities nobody had seen before.

{plate.hide 1.1} {plate porter-kar motion=in over=27 dim=0.16 push=0.09 into=1.4} På sytten hundre tallet lagde London et mørkt, billig øl som het porter. {mark term:porter}
> In the seventeen hundreds London made a dark, cheap beer called porter. {^}
Det var det første ølet som ble laget industrielt. Ett bryggeri kunne sende ut hundre tusen tønner i året.
> It was the first beer made industrially. One brewery could send out a hundred thousand barrels a year.
Det ble lagret i trekar så store at folk holdt middagsselskap inni dem før de ble tatt i bruk.
> It was stored in wooden vats so big that people held dinner parties inside them before they were put to use.

Ett av dem sprakk i atten hundre og fjorten, og over en million liter porter gikk ut i gata og drepte åtte mennesker.
> One of them burst in eighteen fourteen, and over a million litres of porter went out into the street and killed eight people.

## Stout, og en by til | Stout, and one more town
// Uten teppe, og det er et valg. docs/design-direction.md ber om minst
// én scene per kapittel uten musikk — «musikk overalt er musikk
// ingensteds» — og Dublin er kapitlets sidespor. Når teppet kommer
// tilbake på «Nå handler det om stedet», løfter det linja kapitlet
// egentlig handler om.
bed: none

{flyTo dublin zoom=6.4 over=3.8} {marker dublin label=Dublin kind=point} Den sterkeste porteren fikk et eget navn.
> The strongest porter got a name of its own.
{plate stout-glass motion=in over=25 dim=0.14 push=0.08 into=1.4} Stout betyr kraftig. {mark term:stout} Først var det bare et ord man satte foran: stout porter.
> Stout means sturdy. {^} At first it was just a word you put in front: stout porter.
Så falt porter bort, og ordet ble stående alene.
> Then porter fell away, and the word was left standing on its own.

Dublin tok det og gjorde det til sitt. Der brant de en del av kornet svart, nesten som kaffebønner.
> Dublin took it and made it their own. There they roasted part of the grain black, almost like coffee beans.

{plate.hide 1.1} {plate brent-korn motion=in over=22 dim=0.15 push=0.1 into=1.4} Det er derfor et stout smaker av kaffe og mørk sjokolade uten at noen av delene er i det.
> That is why a stout tastes of coffee and dark chocolate without either one being in it.
Samme triks som med frukten, ett trinn tidligere: smaken kommer av behandlingen, ikke av en ingrediens.
> The same trick as with the fruit, one step earlier: the flavour comes from the treatment, not from an ingredient.

Og legg merke til at ingenting av dette handler om stedet ennå. To byer, samme gjær, forskjellig oppskrift.
> And notice that none of this is about the place yet. Two towns, the same yeast, a different recipe.

## Vannet under Burton | The water under Burton
bed: bedBrew

{flyTo burton zoom=7.6 over=4.2} {marker burton label=Burton kind=point tone=gold} Nå handler det om stedet.
> Now it is about the place.
Midt i England ligger en liten by ved elva Trent.
> In the middle of England there is a small town on the river Trent.

{plate burton-bronn motion=in over=26 dim=0.14 push=0.08 into=1.4} Den hadde ingenting spesielt. Ikke bedre korn, ikke bedre humle, ikke flinkere folk.
> It had nothing special. Not better grain, not better hops, not cleverer people.
Den hadde vann som hadde ligget i gips. {mark term:gips}
> It had water that had been lying in gypsum. {^}

{plate.hide 1.1} {plate gips-krystall motion=in over=24 dim=0.16 push=0.09 into=1.4} Gips er kalsium og sulfat. Regnet siger ned gjennom fjellet og tar med seg begge deler.
> Gypsum is calcium and sulfate. Rain seeps down through the rock and takes both with it.
{stat 700 label=milligram sulfat i én liter | milligrams of sulfate in a litre side=ale} I Burton er det omtrent sju hundre milligram sulfat i hver liter. I London er det under seksti.
> In Burton there are about seven hundred milligrams of sulfate in every litre. In London it is under sixty.

{stat.clear} {plate.hide 1.1} {plate bitter-glass motion=in over=27 dim=0.13 push=0.09 into=1.4} Og sulfat gjør noe helt bestemt med et øl. Det skjerper humla.
> And sulfate does something very specific to a beer. It sharpens the hops.

Bitterheten blir tørr og tydelig i stedet for rund. Ølet virker lettere enn det er.
> The bitterness turns dry and clean instead of round. The beer seems lighter than it is.
Kalsiumet gjør en annen jobb: det får gjæren til å synke pent til bunns når den er ferdig.
> The calcium does another job: it makes the yeast settle neatly when it is done.
Så ølet ble klart. Blankt. Og akkurat da begynte folk å drikke av glass i stedet for av krus.
> So the beer came out clear. Bright. And just then people started drinking from glass instead of from tankards.

{plate.hide 1.1} {plate burton-bronn motion=in over=22 dim=0.15 push=0.08 into=1.4} Et øl du kan se gjennom, i en by der vannet gjorde det tørt og skarpt. Det er ikke en tradisjon. Det er kjemi du kan peke på.
> A beer you can see through, in a town where the water made it dry and sharp. That is not a tradition. It is chemistry you can point at.

## Ølet som tålte reisen | The beer that survived the journey
bed: bedBrew

{plate fat-rekke motion=left over=25 dim=0.14 push=0.14 into=1.4} Og så gjorde Burton noe med det ølet som gjorde det verdensberømt. De sendte det bort.
> And then Burton did something with that beer that made it world famous. They sent it away.
Ølet skulle til India, og reisen tok et halvt år rundt Afrika.
> The beer was going to India, and the voyage took half a year around Africa.

Husk fra sist hva humle gjør. Den smaker bittert, og den dreper bakterier.
> Remember from last time what hops do. They taste bitter, and they kill bacteria.
Så bryggerne gjorde det åpenbare: de fylte fatene {mark term:fat} med mer humle enn noe menneske ville drukket frivillig.
> So the brewers did the obvious thing: they filled the casks {^} with more hops than anybody would willingly have poured into a glass.

{plate.hide 1.1} {plate skip-kai motion=in over=23 dim=0.15 push=0.1 into=1.4} Det overlevde. Og det viste seg at et halvt år i et fat på et gyngende skip gjorde ølet bedre, ikke verre.
> It survived. And it turned out that half a year in a cask on a rolling ship made the beer better, not worse.
Humla mykner. Ølet klarner. Det kom fram tørt, blankt og bittert.
> The hops soften. The beer clears. It arrived dry, bright and bitter.

Hjemme i England ville folk plutselig ha det samme. Ølet fikk navnet sitt etter en reise det ikke lenger måtte ta.
> Back home in England people suddenly wanted the same thing. The beer got its name from a voyage it no longer had to make.

{plate.hide 1.1} {plate ipa-glass motion=in over=21 dim=0.13 push=0.09 into=1.4} India Pale Ale. {mark term:ipa} I dag er det verdens mest kopierte ølstil, og nesten ingen av dem har sett et skip.
> India Pale Ale. {^} Today it is the world's most copied beer style, and almost none of them have seen a ship.

## Stedet, og det som ble igjen | The place, and what was left
bed: bedBrew

{plate salt-vekt motion=in over=24 dim=0.14 push=0.08 into=1.4} Så kom kjemien, og med den en litt trist oppdagelse.
> Then chemistry arrived, and with it a slightly sad discovery.
Hvis det er gipsen som gjør det, kan hvem som helst kjøpe gips.
> If it is the gypsum that does it, then anybody can buy gypsum.

Å tilsette sulfat i bryggevannet har hatt et eget navn siden atten hundre og syttitallet. {mark term:burtonisering} Det heter burtonisering, etter byen.
> Adding sulfate to your brewing water has had its own name since the eighteen seventies. {^} It is called Burtonisation, after the town.
Et bryggeri i Oslo eller i Tokyo kan lage Burtons vann i et kar på en ettermiddag.
> A brewery in Oslo or in Tokyo can make Burton's water in a tank in an afternoon.

{plate.hide 1.1} {marker.clear} {flyTo nordsjoen zoom=4.8 over=5.0} {marker burton label=Burton kind=point tone=gold} {marker london label=London kind=point} {marker dublin label=Dublin kind=point} Byen ga fra seg hemmeligheten sin, og stilen dro.
> The town gave up its secret, and the style left.
Men den fikk noe igjen som ikke kan kopieres: den står i navnet. Vi kaller det fortsatt burtonisering.
> But it got something back that cannot be copied: it is in the name. We still call it Burtonisation.

Og det er mønsteret for resten av kurset. Et sted har noe det ikke har valgt — et vann, et fjell, en kjeller, et klima.
> And that is the pattern for the rest of the course. A place has something it did not choose — a water, a mountain, a cellar, a climate.
Det blir til en stil. Stilen får navn etter stedet. Og så reiser stilen fra stedet og blir alles.
> It becomes a style. The style is named after the place. And then the style leaves the place and becomes everyone's.

Neste gang drar vi sørover, til et sted der det motsatte skjedde. Der var det ikke vannet som bestemte. Det var kulda.
> Next time we go south, to a place where the opposite happened. There it was not the water that decided. It was the cold.
