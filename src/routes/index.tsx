import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { z } from 'zod'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useQuerySwr } from '~/hooks/use-query-swr'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: z.object({
    swr: z.boolean().optional(),
  }),
  beforeLoad: async ({ search }) => {
    return {
      swr: search.swr ?? false,
    }
  },
})

function Home() {
  return (
    <main className="p-8 flex flex-col gap-16">
      <h1 className="text-4xl font-bold text-center">
        Convex + Tanstack Start
      </h1>

      <Tabs defaultValue="tab1" className="max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <TabContent tabName="tab1" />
        </TabsContent>
        <TabsContent value="tab2">
          <TabContent tabName="tab2" />
        </TabsContent>
        <TabsContent value="tab3">
          <TabContent tabName="tab3" />
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-8 max-w-lg mx-auto">
        <p>
          Edit{' '}
          <code className="text-sm font-bold font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded-md">
            convex/myFunctions.ts
          </code>{' '}
          to change your backend
        </p>
        <p>
          Edit{' '}
          <code className="text-sm font-bold font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded-md">
            src/routes/index.tsx
          </code>{' '}
          to change your frontend
        </p>
        <p>
          Open{' '}
          <a
            href="/anotherPage"
            className="text-blue-600 underline hover:no-underline"
          >
            another page
          </a>{' '}
          to send an action.
        </p>
        <div className="flex flex-col">
          <p className="text-lg font-bold">Useful resources:</p>
          <div className="flex gap-2">
            <div className="flex flex-col gap-2 w-1/2">
              <ResourceCard
                title="Convex docs"
                description="Read comprehensive documentation for all Convex features."
                href="https://docs.convex.dev/home"
              />
              <ResourceCard
                title="Stack articles"
                description="Learn about best practices, use cases, and more from a growing
            collection of articles, videos, and walkthroughs."
                href="https://www.typescriptlang.org/docs/handbook/2/basic-types.html"
              />
            </div>
            <div className="flex flex-col gap-2 w-1/2">
              <ResourceCard
                title="Templates"
                description="Browse our collection of templates to get started quickly."
                href="https://www.convex.dev/templates"
              />
              <ResourceCard
                title="Discord"
                description="Join our developer community to ask questions, trade tips & tricks,
            and show off your projects."
                href="https://www.convex.dev/community"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function TabContent({ tabName }: { tabName: string }) {
  const { swr } = useRouteContext({ from: Route.id })

  const useQueryFn = swr ? useQuerySwr : useQuery

  const data = useQueryFn(api.myFunctions.listNumbers, {
    tab: tabName,
    count: 10,
  })
  const isLoading = data === undefined
  const { viewer, numbers } = data ?? {}
  const addNumber = useMutation(api.myFunctions.addNumber)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 max-w-lg mx-auto">
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <p>Welcome {viewer ?? 'Anonymous'}!</p>
      <p>
        Click the button below and open this page in another window - this data
        is persisted in the Convex cloud database!
      </p>
      <p>
        <button
          className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
          onClick={() => {
            void addNumber({
              tab: tabName,
              value: Math.floor(Math.random() * 10),
            })
          }}
        >
          Add a random number
        </button>
      </p>
      <p>
        Numbers for {tabName}:{' '}
        {numbers?.length === 0
          ? 'Click the button!'
          : (numbers?.join(', ') ?? '...')}
      </p>
    </div>
  )
}

function ResourceCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <div className="flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-4 rounded-md h-28 overflow-auto">
      <a href={href} className="text-sm underline hover:no-underline">
        {title}
      </a>
      <p className="text-xs">{description}</p>
    </div>
  )
}
