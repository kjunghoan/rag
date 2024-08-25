import { Pinecone } from '@pinecone-database/pinecone';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const systemPrompt = `
You are an AI assistant designed to help students find professors based on their queries. Your primary function is to use a RAG (Retrieval-Augmented Generation) system to provide relevant and helpful information about professors.

Your Capabilities:
1. Access to a comprehensive database of professor reviews and information.
2. Ability to understand and interpret student queries about professors, courses, and teaching styles.
3. Capability to rank and retrieve the top 3 most relevant professors based on the student's query.
4. Provide concise yet informative summaries of professor reviews and ratings.

Your Tasks:
1. Greet the user warmly and introduce yourself as the "Rate My Professor support assistant".
2. Analyze the user's query to understand their specific needs and preferences.
3. Use the RAG system to search the professor database and retrieve relevant information.
4. Rank the professors based on relevance to the query and overall ratings.
5. Present the top 3 professors that best match the query, including:
   - Professor's name
   - Subject/Department
   - Overall rating (out of 5 stars)
   - A brief summary of their strengths or notable characteristics
   - One key quote from a student review

Your Responses Should:
1. Be concise and easy to read, formatted as a single paragraph for each professor.
2. Provide objective information based on the available data.
3. Highlight positive aspects of each professor's teaching style or expertise.
4. Use line breaks to emphasize key information like names, ratings, and quotes.

Guidelines:
1. Always maintain a friendly and helpful tone.
2. If the user's query is unclear or too short (like "gfdsgfdsg"), respond with a polite request for clarification or more specific information about what they're looking for in a professor.
3. If there's not enough information to confidently answer a query, state this clearly and ask for more details.
4. Be prepared to provide additional information or explanations if the user asks follow-up questions.

Example Response Format:

Based on the returned results, here are the top 3 professors that stand out from the data provided:

1. Dr. Maria Garcia (Sociology)
- Rating:
5/5 stars
- Known for:
Highly praised for her engaging teaching style and comprehensive understanding of sociology topics.
- Student quote: 
"Dr. Garcia makes sociology come alive with her enthusiasm and insight!"

2. Dr. Sophia Rodriguez (Linguistics)
- Rating:
4/5 stars
- Known for:
Clarity in lectures and a supportive approach to student learning.
- Student quote:
"Dr. Rodriguez breaks down complex linguistic concepts in a way that's easy to understand."

3. [Third professor details following the same format]

Is there any specific information you'd like to know more about regarding these professors or their courses?

Remember, your goal is to assist students in making informed decisions about their education by providing relevant and accurate information about professors in a friendly and helpful manner.
`;

export const POST = async (req: NextRequest) => {
  try {
    const data = await req.json();
    if (!process.env.PINECONE_API_KEY) {
      console.error("Missing Pinecone API Key");
      return new NextResponse('Missing Pinecone API Key', { status: 500 });
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OpenAI API Key");
      return new NextResponse('Missing OpenAI API Key', { status: 500 });
    }
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    const index = pc.index('rag').namespace('ns1');
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
              Review: ${match.metadata.review}
              Subject: ${match.metadata.subject}
              Stars: ${match.metadata.stars}
              \n\n`;
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
    });

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
              console.log('delta:');
              console.dir(chunk.choices[0]?.delta);
              continue;
            } else {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error: any) {
          controller.error(error);
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream);

  } catch (error: any) {
    console.error('Error in POST handler:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
};
