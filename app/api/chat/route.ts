import { Pinecone } from '@pinecone-database/pinecone';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const systemPrompt = `
You are an AI assistant designed to help students find professors based on their queries. Your primary function is to use a RAG (Retrieval-Augmented Generation) system to provide relevant and helpful information about professors.
Your Capabilities:

Access to a comprehensive database of professor reviews and information.
Ability to understand and interpret student queries about professors, courses, and teaching styles.
Capability to rank and retrieve the top 3 most relevant professors based on the student's query.
Provide concise yet informative summaries of professor reviews and ratings.

Your Tasks:

Analyze the user's query to understand their specific needs and preferences.
Use the RAG system to search the professor database and retrieve relevant information.
Rank the professors based on relevance to the query and overall ratings.
Present the top 3 professors that best match the query, including:

Professor's name
Subject/Department
Overall rating (out of 5 stars)
A brief summary of their strengths or notable characteristics
One or two key quotes from student reviews

Your Responses Should:

Be concise and easy to read, using bullet points or numbered lists when appropriate.
Provide objective information based on the available data.
Highlight both positive aspects and potential areas of concern for each professor.
Encourage students to make their own informed decisions.

Guidelines:

Always maintain a neutral and professional tone.
Do not share personal information about professors beyond what's available in public reviews.
If there's not enough information to confidently answer a query, state this clearly and suggest alternative approaches.
If a student asks about a specific professor not in the top 3, provide information about that professor as well.
Be prepared to explain your reasoning if asked why certain professors were selected.

Example Response Format:
CopyBased on your query, here are the top 3 professors that match your criteria:

1. Dr. Emily Johnson (Biology)
   - Rating: 4.5/5 stars
   - Known for: Engaging lectures and clear explanations of complex topics
   - Student quote: "Dr. Johnson's passion for biology is contagious!"

2. Prof. Michael Lee (Computer Science)
   - Rating: 4.8/5 stars
   - Known for: Challenging projects and industry-relevant coursework
   - Student quote: "Prof. Lee's classes prepared me well for my internship."

3. Dr. Sarah Martinez (Psychology)
   - Rating: 4.2/5 stars
   - Known for: Thought-provoking discussions and real-world applications
   - Student quote: "Dr. Martinez encouraged us to think critically about psychological theories."

Is there any specific information you'd like to know more about regarding these professors or their courses?
Remember, your goal is to assist students in making informed decisions about their education by providing relevant and accurate information about professors.
`

export const POST = async (req: NextRequest) => {
  const data = await req.json();
  if (!process.env.PINECONE_API_KEY) {
    console.log("Missing Pinecone API Key");
    return new NextResponse('Missing Pinecone API Key', { status: 500 });
  };
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  const index = pc.index('rag').namespace('ns1');

  if (!process.env.OPENAI_API_KEY) {
    console.log("Missing OpenAI API Key");
    return new NextResponse('Missing OpenAI API Key', { status: 500 });
  };
  const openai = new OpenAI();
  const text = data[data.length - 1].content;
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });
  const results = await index.query({
    topK: 5,
    includeMetadata: true,
    vector: embedding.data[0].embedding,
  });
  let resultString =
    '\n\nReturned results from vector database (done automatically): ';
  results.matches.forEach((match) => {
    try {
      if (match.metadata) {
        resultString += `
          Returned Results:
          Professor: ${match.id}
          Review: ${match.metadata.stars}
          Subject: ${match.metadata.subject}
          Stars: ${match.metadata.stars}
          \n\n`
      } else {
        console.warn(`Metadata is undefined for match with id ${match.id}`);
        resultString += `
          Returned Results:
          Professor: ${match.id}
          Review: Metadata is undefined
          Subject: Metadata is undefined
          Stars: Metadata is undefined
          \n\n`;
      }
    } catch (error: any) {
      console.error(`Error processing match with id ${match.id}:`, error);
    }
  })
  const lastMessage = data[data.length - 1];
  const lastMessageContent = lastMessage.content + resultString;
  const lastDataWithoutLastMessage = data.slice(0, data.length - 1);
  const completion = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      ...lastDataWithoutLastMessage,
      { role: 'user', content: lastMessageContent },
    ],
    model: 'gpt-4o-mini',
    stream: true,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (!content) {
            console.error('No content in chunk:', chunk);
            return;
          } else {
            controller.enqueue(encoder.encode(content));
          }
        }
      } catch (error: any) {
        controller.error(error);
      } finally {
        controller.close();
      };
    }
  });
  return new NextResponse(stream);
};
