"use client";

import { useState } from 'react';

const CATEGORIES = [
  'Cleaning',
  'Delivery',
  'Handyman',
  'Moving',
  'Technology',
  'Design',
  'Writing',
  'Other'
];

interface TaskFilterProps {
  onFilterChange: (filters: any) => void;
}

export default function TaskFilter({ onFilterChange }: TaskFilterProps) {
  const [category, setCategory] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [location, setLocation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      category,
      minBudget,
      maxBudget,
      location,
      searchTerm
    });
  };

  const clearFilters = () => {
    setCategory('');
    setMinBudget('');
    setMaxBudget('');
    setLocation('');
    setSearchTerm('');
    onFilterChange({
      category: '',
      minBudget: '',
      maxBudget: '',
      location: '',
      searchTerm: ''
    });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">Filter Tasks</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks..."
            className="input-field"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Any location"
            className="input-field"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Budget Range
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
              placeholder="Min"
              className="input-field w-1/2"
              min="0"
            />
            <input
              type="number"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              placeholder="Max"
              className="input-field w-1/2"
              min="0"
            />
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button type="submit" className="btn-primary flex-1">
            Apply Filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}