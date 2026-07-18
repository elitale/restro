import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const cards = [
  { label: "Today's Orders", value: "—", hint: "Orders placed today" },
  { label: "Today's Sales", value: "—", hint: "Gross sales today" },
  { label: "Covers", value: "—", hint: "Guests served today" },
  { label: "Open Tables", value: "—", hint: "Currently seated" },
]

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
          </CardHeader>
          <CardFooter className="text-sm">
            <div className="text-muted-foreground">{card.hint}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
