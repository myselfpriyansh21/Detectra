import type { GraphNode, GraphLink } from '../types'

export function computePageRank(nodes: GraphNode[], links: GraphLink[], iterations = 20, damping = 0.85): Map<string,number> {  
  const scores = new Map<string,number>()  
  const N = nodes.length
  nodes.forEach(n => scores.set(n.id, 1/N))  
  
  const inLinks = new Map<string,string[]>()  
  const outCount = new Map<string,number>()  
  nodes.forEach(n => { inLinks.set(n.id,[]); outCount.set(n.id,0) })  
  links.forEach(l => {    
    const s = typeof l.source==='object' ? (l.source as any).id : l.source    
    const t = typeof l.target==='object' ? (l.target as any).id : l.target    
    inLinks.get(t)?.push(s)    
    outCount.set(s,(outCount.get(s)||0)+1)  
  })  
  
  for(let i=0;i<iterations;i++){    
    const next = new Map<string,number>()    
    nodes.forEach(n=>{      
      const ins = inLinks.get(n.id)||[]      
      const score = ins.reduce((sum,src)=>sum+(scores.get(src)||0)/(outCount.get(src)||1),0)      
      next.set(n.id,(1-damping)/N+damping*score)    
    })    
    next.forEach((v,k)=>scores.set(k,v))  
  }  
  
  // normalize 0-1  
  const max = Math.max(...scores.values())  
  scores.forEach((v,k)=>scores.set(k,v/max))  
  return scores
}

export function detectCommunities(nodes: GraphNode[], links: GraphLink[]): Map<string,number> {  
  const community = new Map<string,number>()  
  nodes.forEach((n,i)=>community.set(n.id,i))  
  
  // Simple label propagation  
  for(let iter=0;iter<10;iter++){    
    nodes.forEach(n=>{      
      const neighbors = links
        .filter(l=>{          
          const s=typeof l.source==='object'?(l.source as any).id:l.source          
          const t=typeof l.target==='object'?(l.target as any).id:l.target          
          return s===n.id||t===n.id        
        })        
        .map(l=>{          
          const s=typeof l.source==='object'?(l.source as any).id:l.source          
          const t=typeof l.target==='object'?(l.target as any).id:l.target          
          return s===n.id?t:s        
        })      
      if(neighbors.length===0) return      
      
      const freq = new Map<number,number>()      
      neighbors.forEach(nb=>{const c=community.get(nb)||0;freq.set(c,(freq.get(c)||0)+1)})      
      const best=[...freq.entries()].sort((a,b)=>b[1]-a[1])[0]      
      if(best) community.set(n.id,best[0])    
    })  
  }  
  
  // Re-index communities 0,1,2...  
  const unique=[...new Set(community.values())]  
  const remap=new Map(unique.map((v,i)=>[v,i]))  
  community.forEach((v,k)=>community.set(k,remap.get(v)||0))  
  return community
}

export function findShortestPath(nodes: GraphNode[], links: GraphLink[], fromId: string, toId: string): string[] {  
  const adj = new Map<string,string[]>()  
  nodes.forEach(n=>adj.set(n.id,[]))  
  links.forEach(l=>{    
    const s=typeof l.source==='object'?(l.source as any).id:l.source    
    const t=typeof l.target==='object'?(l.target as any).id:l.target    
    adj.get(s)?.push(t); adj.get(t)?.push(s)  
  })

  const visited=new Set<string>()  
  const queue:string[][]= [[fromId]]  
  while(queue.length){    
    const path=queue.shift()!    
    const node=path[path.length-1]    
    if(node===toId) return path    
    if(visited.has(node)) continue    
    visited.add(node)    
    const neighbors=adj.get(node)||[]    
    neighbors.forEach(n=>{ if(!visited.has(n)) queue.push([...path,n]) })  
  }  
  return []
}