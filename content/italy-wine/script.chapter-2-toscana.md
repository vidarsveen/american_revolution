// chapter-2-toscana, written as prose. The chapter JSON is compiled from this
// file and is what the engine loads; --check tells you whether the
// two still say the same thing.
//
//     python tools/author.py content/italy-wine/script.chapter-2-toscana.md --check
//     python tools/author.py content/italy-wine/script.chapter-2-toscana.md --write
//     python tools/narrate.py --chapter italy-wine/chapter-2-toscana --lang no
//
// docs/authoring.md writes one from nothing, start to finish, and
// `python tools/author.py --verbs` lists every cue and what it takes.
//
// WHAT THIS CHAPTER IS FOR, from outline.md — if what you are
// writing stops answering this, the outline is the thing to
// change, not this comment:
//
//   Å ta det samme spørsmålet sørover, der druen er én og stedene er
//   mange: Sangiovese under fire navn. Kapittel én forklarte hvorfor
//   stedet står på flaska; dette forklarer hvorfor det samme stedsnavnet
//   kan bety fire ting.

---
id: chapter-2-toscana
pack: italy-wine
title: Én drue, fire adresser | One grape, four addresses
subtitle: Toscana, fra Firenze til havet | Tuscany, from Florence to the sea
regions: geo/zones.geojson
---

# places
roma  41.9028, 12.4964  zoom=9.0  kind=city  Roma | Rome
firenze  43.7696, 11.2558  zoom=9.4  kind=city  Firenze | Florence
siena  43.3188, 11.3308  zoom=10.2  kind=city  Siena
chianti  43.5200, 11.3200  zoom=10.6  kind=region  Chianti
greve  43.5856, 11.3163  zoom=11.6  kind=town  Greve
montalcino  43.0567, 11.4894  zoom=11.8  kind=town  Montalcino
montepulciano  43.0989, 11.7828  zoom=11.8  kind=town  Montepulciano
scansano  42.6889, 11.3339  zoom=11.4  kind=town  Scansano
grosseto  42.7635, 11.1128  zoom=10.6  kind=city  Grosseto
abruzzo  42.2000, 13.8000  zoom=8.6  kind=region  Abruzzo
apenninene  43.9000, 11.6000  zoom=8.2  kind=hill  Apenninene | The Apennines

# ending
say: Fire navn, ett sted om gangen, og den samme druen i alle fire. Adressen er opplysningen. | Four names, one place at a time, and the same grape in all four. The address is the information.
figure.value: 1716
figure.label: året Chianti fikk en grense | the year Chianti got a boundary

## Tre navn, én drue | Three names, one grape

{music bedWarm} {mood day} {plate tre-flasker motion=in over=18 dim=0.14 push=0.07 into=1.4} Toscana lager tre store rødviner.
> Tuscany makes three great red wines.
Tre navn, tre steder, og under to timer mellom dem.
> Three names, three places, and less than two hours between them.

{plate.hide 1.1} {flyTo firenze zoom=7.6 over=3.6} De heter Chianti {marker greve label=Chianti kind=point tone=gold}, Brunello di Montalcino {marker montalcino label=Brunello kind=point tone=gold} og Vino Nobile di Montepulciano {marker montepulciano label=Vino Nobile kind=point tone=gold}.
> They are called Chianti {^1}, Brunello di Montalcino {^2} and Vino Nobile di Montepulciano {^3}.

{plate sangiovese-klase motion=in over=22 dim=0.16 push=0.09 into=1.4} Og det er den samme druen {mark term:drue} i alle tre.
> And it is the same grape {^} in all three.
Den heter Sangiovese {fact grape:sangiovese}, og den er den mest plantede druen i Italia.
> It is called Sangiovese {^}, and it is the most planted grape in Italy.

Ingen av de tre navnene er druens navn. Alle tre er steder på kartet.
> Not one of those three names is the grape's. All three are places on the map.
{plate.hide 1.1} Forrige gang lærte vi at navnet på flaska er et sted. Nå skal vi se hva stedet faktisk gjør.
> Last time we learned that the name on the bottle is a place. Now we look at what the place actually does.

## Surkirsebær og tomatblad | Sour cherry and tomato leaf

{music bedPatient} {plate glass-blek-rod motion=in over=18 dim=0.14 push=0.08 into=1.4} Sangiovese smaker surkirsebær, tomatblad og te.
> Sangiovese tastes of sour cherry, tomato leaf and tea.
Den har mye syre og mye tannin, men gir lite farge. Vinen er ofte lysere i glasset enn du venter.
> It has high acid and high tannin, but gives little colour. The wine is often paler in the glass than you expect.

{plate.hide 1.1} Til sammenligning: Nebbiolo fra forrige kapittel er enda hardere, og enda blekere. {chart grape:sangiovese kind=profile against=grape:nebbiolo note=Samme skala som sist. | The same scale as last time.}
> For comparison: the Nebbiolo from last time is harder still, and paler still. {^}
Men Sangiovese er lunefull på en annen måte. Det finnes over hundre registrerte kloner {mark term:klon} av den.
> But Sangiovese is fickle in another way. There are over a hundred registered clones {^} of it.

{chart.hide} En klon {fact term:klon} er én utvalgt plante, dyrket videre fordi noen likte det den gjorde.
> A clone {^} is one chosen vine, propagated onwards because somebody liked what it did.
Forskjellen mellom klonene er stor nok til å kjennes i glasset. Husk det til vi kommer til Montalcino.
> The difference between the clones is large enough to taste. Remember that until we get to Montalcino.

## Bakkene mellom to byer | The hills between two cities

{music bedMist} {flyTo firenze zoom=8.2 over=3.0} {region Toscana side=red vary=false over=1.6} Toscana ligger midt på støvelen, mellom Apenninene og havet.
> Tuscany lies halfway down the boot, between the Apennines and the sea.
{plate toscana-bakker motion=in over=22 dim=0.12 push=0.14 into=1.4} Det meste av vinlandet ligger i bakker mellom to og seks hundre meter over havet.
> Most of the wine country lies in hills between two and six hundred metres above sea level.
Høyden gir kalde netter, akkurat som i Piemonte. Men her er sommeren tørrere.
> The height gives cold nights, exactly as in Piedmont. But here the summer is drier.

{plate.hide 1.1} {plate galestro-jord motion=in over=18 dim=0.16 push=0.08 into=1.4} Jorda har et eget navn: galestro. En skifrig leire som smuldrer mellom fingrene.
> The soil has its own name: galestro. A flaky clay that crumbles between your fingers.
Den holder dårlig på vann, og det er meningen. En plante som må lete etter vann, lager færre og bedre druer.
> It holds water badly, and that is the point. A vine that has to search for water makes fewer and better grapes.

{plate.hide 1.1} {fitPlaces firenze,siena over=3.4} Og mellom Firenze og Siena ligger området der alt dette begynte.
> And between Florence and Siena lies the area where all of this began.

## Hanen og grensen | The rooster and the boundary

{music bedHollow} {ambience vineyard gainDb=-15} {flyTo chianti zoom=8.6 over=3.0} {region Toscana side=neutral vary=false strength=0.35 over=1.6} Chianti er et sted. Det har det alltid vært. {region Chianti Classico side=red vary=false over=1.6}
> Chianti is a place. It always has been. {^}
{marker greve label=Greve kind=point tone=gold} I syttenhundreogseksten trakk storhertugen av Toscana en grense rundt det. {fact wine:chianti}
> In seventeen sixteen the Grand Duke of Tuscany drew a boundary around it. {^}

Han bestemte hvor vin med det navnet kunne komme fra. Det er en av de eldste vinlovene i verden.
> He decided where wine with that name could come from. It is one of the oldest wine laws in the world.
Så ble navnet populært. Og et populært navn blir som regel også større.
> Then the name became popular. And a popular name usually becomes bigger, too.

{marker.clear} I nittentrettito ble Chianti utvidet til å dekke sju underområder rundt kjernen. {region Chianti side=red vary=false strength=0.45 over=2.2}
> In nineteen thirty-two Chianti was enlarged to cover seven sub-areas around the core. {^}
Det gamle kjerneområdet trengte da et ord for seg selv. De la til classico {mark term:classico}, og satte en svart hane på flaska.
> The old core then needed a word of its own. They added classico {^}, and put a black rooster on the bottle.

{fact term:classico} Chianti Classico er altså den opprinnelige Chianti. Chianti er alt som kom til etterpå.
> So Chianti Classico is the original Chianti. Chianti is everything that was added afterwards.
Det er ikke et kvalitetsstempel. Det er en opplysning om sted, og stedet er det eneste flaska egentlig lover.
> It is not a stamp of quality. It is a statement about place, and the place is the only thing the bottle really promises.

## Én høyde, fem år | One hill, five years

{music bedPatient} {region.clear} {flyTo montalcino zoom=9.6 over=3.4} {region Montalcino side=red vary=false over=1.6} Sør for Siena ligger en enkelt høyde med en by på toppen. Montalcino. {plate montalcino-hoyde motion=in over=22 dim=0.14 push=0.12 into=1.4 @end}
> South of Siena there is a single hill with a town on top. Montalcino.
Her er det varmere og tørrere enn i Chianti, og druene henger lenger.
> It is warmer and drier here than in Chianti, and the grapes hang longer.

{plate.hide 1.1} På attenhundretallet valgte en familie her ut én plante {mark term:klon} som ga mørkere og mer holdbar vin enn naboene.
> In the nineteenth century a family here singled out one vine {^} that gave a darker, longer-lived wine than its neighbours.
De kalte den Brunello {fact wine:brunello-di-montalcino}, den lille brune. Det er Sangiovese, men en bestemt klon av den.
> They called it Brunello {^}, the little brown one. It is Sangiovese, but one particular clone of it.

{plate kjeller-fat motion=in over=18 dim=0.16 push=0.09 into=1.4} Brunello di Montalcino må ligge i fem år før den selges. Minst to av dem på trefat.
> Brunello di Montalcino must lie for five years before it is sold. At least two of them in wood.
Det er blant de lengste lagringskravene i Italia, og det er den samme regningen som i Barolo: tre år der vinen bare koster penger. {plate.hide 1.1 @end}
> That is among the longest ageing requirements in Italy, and it is the same bill as in Barolo: three years in which the wine only costs money.

## Fella i navnet | The trap in the name

{region.clear} {flyTo montepulciano zoom=9.6 over=3.2} {region Montepulciano side=red vary=false over=1.6} En time østover ligger Montepulciano, på en åsrygg med utsikt begge veier.
> An hour east lies Montepulciano, on a ridge with a view both ways.
Vinen derfra heter Vino Nobile di Montepulciano. Den er også Sangiovese. {fact wine:vino-nobile}
> The wine from there is called Vino Nobile di Montepulciano. It is also Sangiovese. {^}
Her heter klonen Prugnolo Gentile, og vinen må ligge to år før salg.
> Here the clone is called Prugnolo Gentile, and the wine must age two years before sale.

{flyTo abruzzo zoom=8.0 over=3.6} {region Abruzzo side=neutral over=1.6} Og her er fella. Montepulciano er også navnet på en helt annen drue.
> And here is the trap. Montepulciano is also the name of an entirely different grape.
Den vokser i Abruzzo, på den andre siden av Apenninene, og har ingenting med byen å gjøre.
> It grows in Abruzzo, on the other side of the Apennines, and has nothing to do with the town.

{region.clear} Montepulciano d'Abruzzo er altså en drue fra et sted. Vino Nobile di Montepulciano er et sted, og en annen drue.
> So Montepulciano d'Abruzzo is a grape from a place. Vino Nobile di Montepulciano is a place, and a different grape.
Regelen holder likevel. Det som står med størst skrift er stedet. Men et navn kan være begge deler, og da må du vite hvilket.
> The rule still holds. What is written largest is the place. But a name can be both, and then you have to know which.

## Ned til havet | Down to the sea

{music bedWarm} {ambience vineyard gainDb=-15} {region.clear} {flyTo scansano zoom=9.0 over=3.6} Til slutt kjører vi ned mot kysten, til Maremma. {region Maremma side=red vary=false over=1.6}
> Finally we drive down towards the coast, to the Maremma. {^}
{plate maremma-kyst motion=in over=24 dim=0.14 push=0.1 into=1.4} Dette var malariamyr og nesten folketomt til det ble tørrlagt på nittenhundretallet.
> This was malarial marsh and nearly empty of people until it was drained in the twentieth century.

Her er det varmere og lavere, og vinen blir rundere og mykere i tanninene. {fact wine:morellino}
> It is warmer and lower here, and the wine comes out rounder and softer in the tannins. {^}
Den heter Morellino di Scansano. Fjerde navn på den samme druen.
> It is called Morellino di Scansano. A fourth name for the same grape.

{plate.hide 1.1} {chart wine:brunello-di-montalcino kind=profile against=wine:morellino note=Samme drue, hundre kilometer fra hverandre. | The same grape, a hundred kilometres apart.} Fra en høyde inne i landet til en slette ved havet: samme plante, to helt forskjellige viner.
> From a hill inland to a plain by the sea: the same vine, two completely different wines.

{chart.hide} {flyTo roma zoom=5.0 over=4.4} Chianti, Brunello, Nobile, Morellino. To regioner av tjue, og vi har fortsatt bare stilt ett spørsmål.
> Chianti, Brunello, Nobile, Morellino. Two regions of twenty, and we have still only asked one question.
Hvor er den fra? Alt annet på flaska følger av svaret.
> Where is it from? Everything else on the bottle follows from the answer.
