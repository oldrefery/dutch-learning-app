-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (linked to auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create collections table
CREATE TABLE public.collections (
    collection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create words table (core table with SRS fields)
CREATE TABLE public.words (
    word_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES public.collections(collection_id) ON DELETE SET NULL,
    dutch_lemma TEXT NOT NULL,
    dutch_original TEXT,
    part_of_speech TEXT,
    is_irregular BOOLEAN DEFAULT FALSE,
    translations JSONB NOT NULL,
    examples JSONB[],
    image_url TEXT,
    tts_url TEXT NOT NULL,
    -- SRS fields
    interval_days INTEGER NOT NULL DEFAULT 1,
    repetition_count INTEGER NOT NULL DEFAULT 0,
    easiness_factor FLOAT NOT NULL DEFAULT 2.5,
    next_review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile" 
    ON public.users FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.users FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
    ON public.users FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- RLS Policies for collections table
CREATE POLICY "Users can view their own collections" 
    ON public.collections FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own collections" 
    ON public.collections FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections" 
    ON public.collections FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections" 
    ON public.collections FOR DELETE 
    USING (auth.uid() = user_id);

-- RLS Policies for words table
CREATE POLICY "Users can view their own words" 
    ON public.words FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own words" 
    ON public.words FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own words" 
    ON public.words FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own words" 
    ON public.words FOR DELETE 
    USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_collections_user_id ON public.collections(user_id);
CREATE INDEX idx_words_user_id ON public.words(user_id);
CREATE INDEX idx_words_collection_id ON public.words(collection_id);
CREATE INDEX idx_words_next_review_date ON public.words(next_review_date);
CREATE INDEX idx_words_created_at ON public.words(created_at);

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
