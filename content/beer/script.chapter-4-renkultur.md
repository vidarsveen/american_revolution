// chapter-4-renkultur, skrevet som prosa. Kapittel-JSON kompileres fra denne
// fila og er det motoren laster; --check sier om de to fortsatt sier det samme.
//
//     python tools/author.py content/beer/script.chapter-4-renkultur.md --check
//     python tools/author.py content/beer/script.chapter-4-renkultur.md --write
//     python tools/narrate.py --chapter beer/chapter-4-renkultur --lang no
//
// DETTE KAPITLET HAR INGEN GRUNN, og det er et argument og ikke en
// forglemmelse. `shows:` i outline.md sier pictures, cards, charts — ikke
// map — og grunnen er hele poenget med kapitlet: to og tre handlet om at
// stedet bestemmer, og her er oppfinnelsen som gjorde stedet likegyldig.
// En renkultur i en flaske kan sendes i posten. Når hvem som helst kan
// brygge det samme hvor som helst, er det ingenting igjen å tegne på et
// kart, og et tomt kart under den setningen ville motsagt den.
//
// Det er også kursets vendepunkt. Spørsmålet — hvorfor smaker øl av tusen
// ting når det bare er laget av fire — får sitt egentlige svar her, og
// regningen kommer i samme kapittel. Scene seks er regningen.

---
id: chapter-4-renkultur
pack: beer
title: Mannen som fanget gjæren | The man who caught the yeast
subtitle: København, 1883 | Copenhagen, 1883
ground: none
---

# ending
say: Én celle, dyrket fram og gitt bort. Neste gang: landet som aldri gjorde det. | One cell, grown and given away. Next time: the country that never did it.
figure.value: 1
figure.label: celle, og all verdens øl forandret seg | cell, and the beer of the world changed

## Noe surt i kjelleren | Something sour in the cellar
bed: bedBrew

{plate surt-kar motion=in over=25 dim=0.15 push=0.09 into=1.4} Tenk deg at du eier et bryggeri i attenhundreogsyttiårene.
> Imagine you own a brewery in the eighteen seventies.
Du har gjort alt likt i tjue år. Samme korn, samme vann, samme kjeller, samme kar.
> You have done everything the same way for twenty years. Same grain, same water, same cellar, same vessel.

Og så, en uke i mai, er ølet surt.
> And then, one week in May, the beer is sour.
{plate.hide 1.1} {plate kjeller-kald motion=in over=22 dim=0.16 push=0.08 into=1.4} Ikke litt surt. Uselgelig. Hele kjelleren, tusenvis av liter, ut i rennesteinen.
> Not slightly sour. Unsellable. The whole cellar, thousands of litres, into the gutter.

Du vet ikke hvorfor. Du kan ikke vite hvorfor. Og du vet ikke om det skjer igjen neste uke.
> You do not know why. You cannot know why. And you do not know whether it happens again next week.

## Den fjerde ingrediensen, fortsatt usynlig | The fourth ingredient, still invisible
bed: bedBrew

{plate.hide 1.1} {plate gjaerkake-krukke motion=left over=23 dim=0.14 push=0.13 into=1.4} Husk hvor vi står. Gjæren er der, den jobber, og ingen har sett den ordentlig.
> Remember where we are. The yeast is there, it works, and nobody has seen it properly.
Du arver den som ligger i huset. Du skummer den av toppen, eller du henter bunnfallet, og du bruker den om igjen.
> You inherit whatever is in the house. You skim it off the top, or you take the sediment, and you use it again.

{plate.hide 1.1} {plate mikroskop-bord motion=in over=24 dim=0.15 push=0.08 into=1.4} I attenhundreogsyttiseks skriver Louis Pasteur en bok om øl.
> In eighteen seventy-six Louis Pasteur writes a book about beer.
Han har allerede vist at gjæring gjøres av levende vesener, og at det som ødelegger mat også er levende vesener.
> He has already shown that fermentation is done by living creatures, and that what spoils food is living creatures too.

{plate.hide 1.1} {plate surt-kar motion=in over=21 dim=0.15 push=0.09 into=1.4} Så ølet surner ikke av seg selv. Noe kommer inn og gjør det.
> So beer does not go sour by itself. Something gets in and does it.
Pasteur foreslår en løsning: varm det opp akkurat nok til å drepe det som lever i det. {mark term:pasteurisering}
> Pasteur proposes a solution: heat it just enough to kill what is living in it. {^}

Det virker. Men det løser feil halvdel av problemet. Det redder ølet etterpå. Det gjør ingenting med gjæren du starter med.
> It works. But it solves the wrong half of the problem. It saves the beer afterwards. It does nothing about the yeast you start with.

## Et laboratorium med en merkelig regel | A laboratory with a strange rule
bed: none

{plate.hide 1.1} {plate lab-benk motion=in over=26 dim=0.14 push=0.09 into=1.4} I København sitter en bryggerieier som heter Jacob Christian Jacobsen.
> In Copenhagen there is a brewery owner called Jacob Christian Jacobsen.
I attenhundreogsyttifem bygger han et laboratorium ved siden av bryggeriet, og ansetter forskere.
> In eighteen seventy-five he builds a laboratory next to the brewery, and hires scientists.

Det er ikke det merkelige. Det merkelige er regelen han gir det.
> That is not the strange part. The strange part is the rule he gives it.
Alt laboratoriet finner ut, skal offentliggjøres. Gratis. Også til konkurrentene.
> Everything the laboratory works out is to be published. Free. To competitors as well.

{plate.hide 1.1} {plate vedtekter-penn motion=in over=20 dim=0.14 push=0.09 into=1.4} Han skriver det inn i vedtektene, så ingen senere eier kan ombestemme seg.
> He writes it into the statutes, so that no later owner can change their mind.

## Én celle | One cell
bed: bedBrew

{plate.hide 1.1} {plate hansen-mikroskop motion=in over=25 dim=0.14 push=0.08 into=1.4} I laboratoriet jobber en botaniker som heter Emil Christian Hansen.
> Working in the laboratory is a botanist called Emil Christian Hansen.
Han ser på bryggerigjær i mikroskop, og legger merke til noe ingen hadde tenkt på.
> He looks at brewery yeast under a microscope, and notices something nobody had thought of.

Det er ikke én gjær. Det er en blanding.
> It is not one yeast. It is a mixture.
I den samme grumsete klumpen ligger flere arter om hverandre, og noen av dem gjør ølet godt mens andre gjør det surt.
> In the same murky lump there are several species mixed together, and some of them make the beer good while others make it sour.

{plate.hide 1.1} {plate fortynning-rekke motion=in over=24 dim=0.15 push=0.09 into=1.4} Så gjør han det som er hele kapitlet. Han fortynner gjæren igjen og igjen, til det er så få celler igjen i dråpen at han kan dyrke fram én.
> Then he does the thing this whole chapter is about. He dilutes the yeast again and again, until there are so few cells left in the drop that he can grow one on its own.
{fact term:renkultur} Én celle deler seg til to. To til fire. Etter noen døgn er det milliarder, og alle er kopier av den ene.
> One cell divides into two. Two into four. After a few days there are billions, and every one is a copy of that one.

Det heter en renkultur. {mark term:renkultur}
> That is called a pure culture. {^}

{plate.hide 1.1} {plate gjaerkrone-kar motion=in over=20 dim=0.14 push=0.09 into=1.4} I attenhundreogåttitre brygger bryggeriet med den. Det virker.
> In eighteen eighty-three the brewery brews with it. It works.

## Og så ga de den bort | And then they gave it away
bed: bedBrew

{plate.hide 1.1} {plate gjaer-flaske motion=in over=23 dim=0.14 push=0.09 into=1.4} Her kunne historien tatt en annen vei.
> Here the story could have gone another way.
De hadde en gjær som ikke sviktet, i en tid da konkurrentene mistet hele kjellere. Det er verdt en formue.
> They had a yeast that did not fail, at a time when competitors were losing whole cellars. That is worth a fortune.

De ga den bort.
> They gave it away.
Metoden ble publisert, og gjæren ble sendt gratis til alle bryggerier som ba om den.
> The method was published, and the yeast was sent free to any brewery that asked.

{stat 1 label=celle, sendt til hele verden | cell, sent to the whole world side=lager} Innen få år brygget halve Europa med etterkommere av den ene cellen fra det laboratoriet.
> Within a few years half of Europe was brewing with descendants of that one cell from that laboratory.

## Gjær du kan bestille | Yeast you can order
bed: bedBrew

{stat.clear} {plate.hide 1.1} {plate gjaerbank-hyller motion=left over=25 dim=0.15 push=0.13 into=1.4} Etter det ble gjær en ting man kan bestille.
> After that, yeast became something you order.
Det finnes gjærbanker {mark term:gjaerbank} i dag med tusenvis av stammer, frosset ned, hver med et nummer.
> There are yeast banks {^} today with thousands of strains, frozen, each with a number.

{plate.hide 1.1} {plate gjaer-flaske motion=in over=21 dim=0.14 push=0.09 into=1.4} Du velger den som gir smaken du vil ha, og du får nøyaktig den samme neste gang.
> You choose the one that gives the flavour you want, and you get exactly the same one next time.

{compare part=1 "1 av 20" gjaer Før renkulturen | Before pure culture part=1 "sjelden" lager Etter | After mode=bar note=Hvor ofte et brygg ble ødelagt. | How often a brew was ruined.} Og der en brygger før mistet brygg han ikke kunne forklare, kan et bryggeri nå love at ølet smaker likt hver gang. {mark term:kvalitetskontroll}
> And where a brewer used to lose brews he could not explain, a brewery can now promise the beer tastes the same every time. {^}

{compare.clear} Det er ikke en liten ting. Det er grunnlaget for at øl i det hele tatt kan lages i fabrikk. {mark term:industriol}
> That is not a small thing. It is the reason beer can be made in a factory at all. {^}

## Regningen | The bill
bed: none

{plate.hide 1.1} {plate pils-rekke motion=in over=24 dim=0.15 push=0.09 into=1.4} Og nå kommer regningen, for den kommer i samme kapittel.
> And now the bill, because it arrives in the same chapter.
Hvis du kan velge en gjær som aldri skuffer, hvorfor skulle du bruke den rare i huset?
> If you can choose a yeast that never disappoints, why would you use the odd one in the house?

Så det gjorde ingen. Og de lokale gjærene, som hadde levd i hvert sitt bryggeri i hundrevis av år, forsvant nesten helt.
> So nobody did. And the local yeasts, which had lived in one brewery each for hundreds of years, very nearly disappeared.
De var ikke bedre. Mange av dem var upålitelige. Men de var forskjellige, og forskjellen var gratis.
> They were not better. Many of them were unreliable. But they were different, and the difference was free.

{plate.hide 1.1} {plate gjaerkake-krukke motion=out over=22 dim=0.14 push=0.12 into=1.4} Nå har du svaret på spørsmålet kurset åpnet med.
> Now you have the answer to the question this course opened with.
Øl smaker av tusen ting fordi den fjerde ingrediensen lever, og alt levende er forskjellig.
> Beer tastes of a thousand things because the fourth ingredient is alive, and everything alive is different.
Og i hundre år etter attenhundreogåttitre brukte vi stort sett den samme.
> And for a hundred years after eighteen eighty-three we mostly used the same one.

Neste gang drar vi til det ene stedet i Europa som aldri gjorde dette. Der lar de fortsatt lufta gjøre jobben.
> Next time we go to the one place in Europe that never did this. There they still let the air do the work.
