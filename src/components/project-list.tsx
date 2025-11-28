"use client";

import { useState, useMemo } from "react";
import { ProjectSummary } from "@/lib/types";
import { ProjectCard } from "./project-card";
import { SearchInput } from "./search-input";

type SortOption = "recent" | "name" | "messages" | "sessions";

interface ProjectListProps {
  projects: ProjectSummary[];
}

export function ProjectList({ projects }: ProjectListProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");

  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.path.toLowerCase().includes(searchLower)
      );
    }

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "messages":
          return b.totalMessages - a.totalMessages;
        case "sessions":
          return b.sessionCount - a.sessionCount;
        case "recent":
        default:
          return b.lastActivity - a.lastActivity;
      }
    });
  }, [projects, search, sort]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search projects..."
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-300 focus:outline-none focus:border-amber-600 cursor-pointer"
        >
          <option value="recent">Most Recent</option>
          <option value="name">Name</option>
          <option value="messages">Most Messages</option>
          <option value="sessions">Most Sessions</option>
        </select>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          {search ? "No projects found matching your search" : "No projects found"}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.path} project={project} />
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-neutral-600 text-center">
        {filteredProjects.length} of {projects.length} projects
      </div>
    </div>
  );
}
