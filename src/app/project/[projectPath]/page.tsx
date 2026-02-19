import { ProjectPageContent } from '@/components/project-page-content'

interface Props {
  params: Promise<{ projectPath: string }>
}

export default async function ProjectPage({ params }: Props) {
  const { projectPath } = await params
  return <ProjectPageContent encodedPath={projectPath} />
}
