"use client"

import {useQuery} from "convex/react";
import {api} from "../../convex/_generated/api";

const Page = () => {
    const projects = useQuery(api.projects.get);

    return (
        <div className="flex flex-col gap-2 p-4">
          {projects?.map((project) => (
              <div className="border rounded p-2 flex flex-col" key={project._id}>
                <p>{project.name}</p>
                <p>Is completed: {project.ownerId}</p>
              </div>
          ))}
        </div>
    )
}
export default Page
