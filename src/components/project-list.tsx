"use client";

import { useState, useMemo, useEffect } from "react";
import { ProjectSummary } from "@/lib/types";
import { ProjectCard } from "./project-card";
import { SearchInput } from "./search-input";

type SortOption = "recent" | "name" | "messages" | "sessions";

let cachedProjects: ProjectSummary[] | null = null;

function ProjectListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="h-5 w-40 bg-neutral-800 rounded animate-pulse" />
              <div className="h-3 w-64 bg-neutral-800/50 rounded animate-pulse mt-2" />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="h-3 w-20 bg-neutral-800/50 rounded animate-pulse" />
            <div className="h-3 w-24 bg-neutral-800/50 rounded animate-pulse" />
            <div className="h-3 w-16 bg-neutral-800/50 rounded animate-pulse ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(cachedProjects);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");

  useEffect(() => {
    let cancelled = false;

    function loadProjects() {
      fetch("/api/projects")
        .then((res) => res.json())
        .then((data: ProjectSummary[]) => {
          if (cancelled) return;
          cachedProjects = data;
          setProjects(data);
        });
    }

    loadProjects();
    window.addEventListener("sync-complete", loadProjects);
    return () => {
      cancelled = true;
      window.removeEventListener("sync-complete", loadProjects);
    };
  }, []);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];

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

      {projects === null ? (
        <ProjectListSkeleton />
      ) : filteredProjects.length === 0 ? (
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

      {projects !== null && (
        <div className="mt-4 text-xs text-neutral-600 text-center">
          {filteredProjects.length} of {projects.length} projects
        </div>
      )}
    </div>
  );
}
